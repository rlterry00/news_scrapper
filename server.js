// Dependencies

var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var mongojs = require("mongojs");

var databaseUrl = "newsscrapperdb";
var collections = ["comments"];
var PORT = process.env.PORT

// Hook mongojs config to db variable
var db = mongojs(databaseUrl, collections);

// Log any mongojs errors to console
db.on("error", function(error) {
  console.log("Database Error:", error);
});

// Requiring models
var Comment = require("./models/comments.js");
var Article = require("./models/articles.js");

//scraping tools
var request = require("request");
var cheerio = require("cheerio");

mongoose.Promise = Promise;

// Initialize Express
var app = express();


// Use morgan and body parser 
app.use(logger("dev"));
app.use(bodyParser.urlencoded({
  extended: false
}));

// public static dir
app.use(express.static("public"));



// Database configuration with mongoose
mongoose.connect("mongodb://heroku_ml01xlxt:34pbvfhpnr4sucmncubiip3g3n@ds135382.mlab.com:35382/heroku_ml01xlxt");
var db = mongoose.connection;

db.on("error", function(error) {
  console.log("Mongoose Error: ", error);
});

db.once("open", function() {
  console.log("Mongoose connection successful.");
});

app.get("/", function(req, res) {
  res.send(index.html);
});

app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("http://www.tmz.com/", function(error, response, html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);
    
    $("article").each(function(i, element) {

      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this).children("a").text();
      result.link = $(this).children("a").attr("href");

      // Using our Article model, create a new entry
      // This effectively passes the result object to the entry (and the title and link)
      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        // Or log the doc
        else {
          console.log(doc);
        }
      });

    });
  });
  // // Tell the browser that we finished scraping the text
  res.send(index.html);
});

app.get("/articles", function(req, res) {
  // Grab every doc in the Articles array
  Article.find({}, function(error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Or send the doc to the browser as a json object
    else {
      res.json(doc);
    }
  });
});

// Grab an article by it's ObjectId
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  Article.findOne({ "_id": req.params.id })
  // ..and populate all of the notes associated with it
  .populate("comments")
  // now, execute our query
  .exec(function(error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise, send the doc to the browser as a json object
    else {
      res.json(doc);
    }
  });
});


// Create a new note or replace an existing note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  var newComment = new Comment(req.body);

  // And save the new note the db
  newComment.save(function(error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise
    else {
      // Use the article id to find and update it's note
      Article.findOneAndUpdate({ "_id": req.params.id }, { "comments": doc._id })
      // Execute the above query
      .exec(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        else {
          // Or send the document to the browser
          res.send(doc);
        }
      });
    }
  });
});

// Handle form submission, save submission to mongo
app.post("/submit", function(req, res) {
  console.log(req.body);
  // Insert the note into the notes collection
  db.comments.insert(req.body, function(error, saved) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise, send the note back to the browser
    // This will fire off the success function of the ajax request
    else {
      res.send(saved);
    }
  });
});

// Retrieve results from mongo
app.get("/all", function(req, res) {
  // Find all notes in the notes collection
  db.comments.find({}, function(error, found) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise, send json of the notes back to user
    // This will fire off the success function of the ajax request
    else {
      res.json(found);
    }
  });
});

// Select just one note by an id
app.get("/find/:id", function(req, res) {

  // When searching by an id, the id needs to be passed in
  // as (mongojs.ObjectId(IDYOUWANTTOFIND))

  // Find just one result in the notes collection
  db.comments.findOne({
    // Using the id in the url
    "_id": mongojs.ObjectId(req.params.id)
  }, function(error, found) {
    // log any errors
    if (error) {
      console.log(error);
      res.send(error);
    }
    // Otherwise, send the note to the browser
    // This will fire off the success function of the ajax request
    else {
      console.log(found);
      res.send(found);
    }
  });
});


// Update just one note by an id
app.post("/update/:id", function(req, res) {
  
  // When searching by an id, the id needs to be passed in
  // as (mongojs.ObjectId(IDYOUWANTTOFIND))

  // Update the note that matches the object id
  db.comments.update({
    "_id": mongojs.ObjectId(req.params.id)
  }, {
    // Set the title, note and modified parameters
    // sent in the req's body.
    $set: {
      "title": req.body.title,
      "note": req.body.note,
      "modified": Date.now()
    }
  }, function(error, edited) {
    // Log any errors from mongojs
    if (error) {
      console.log(error);
      res.send(error);
    }
    // Otherwise, send the mongojs response to the browser
    // This will fire off the success function of the ajax request
    else {
      console.log(edited);
      res.send(edited);
    }
  });
});


// Delete One from the DB
app.get("/delete/:id", function(req, res) {
  // Remove a note using the objectID
  db.comments.remove({
    "_id": mongojs.ObjectID(req.params.id)
  }, function(error, removed) {
    // Log any errors from mongojs
    if (error) {
      console.log(error);
      res.send(error);
    }
    // Otherwise, send the mongojs response to the browser
    // This will fire off the success function of the ajax request
    else {
      console.log(removed);
      res.send(removed);
    }
  });
});


// Clear the DB
app.get("/clearall", function(req, res) {
  // Remove every note from the notes collection
  db.comments.remove({}, function(error, response) {
    // Log any errors to the console
    if (error) {
      console.log(error);
      res.send(error);
    }
    // Otherwise, send the mongojs response to the browser
    // This will fire off the success function of the ajax request
    else {
      console.log(response);
      res.send(response);
    }
  });
});

app.listen(PORT, function() {
    console.log("App listening on PORT " + PORT);
  });
});



// app.listen(3000, function() {
//   console.log("App running on port 3000!");
// });