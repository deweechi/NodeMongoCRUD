const postCollection = require('../db').db().collection("posts");
const followsCollection = require('../db').db().collection("follows");
const ObjectID = require('mongodb').ObjectID;
const User = require('./User');
const sanitizeHTML = require('sanitize-html');

let Post = function(data, userid, requestedPostId) {
    this.data = data;
    this.errors = [];
    this.userid = userid;
    this.requestedPostId = requestedPostId;

}

Post.prototype.create = function() {
    return new Promise((resolve, reject)=>{
        this.cleanUp();
        this.validate();
       if (!this.errors.length) {
            //save post
            postCollection.insertOne(this.data).then((info)=>{
                resolve(info.ops[0]._id);
            }).catch(()=>{
                this.errors.push("We ran into some trouble, please try again later.");
                reject(this.errors);
            });
            
       } else {
            //reject
            reject(this.errors);
       }
    })
}

Post.prototype.update = function() {
    return new Promise(async (resolve, reject) => {
        try {
            let post = await Post.findSingleById(this.requestedPostId, this.userid);
            
            //check if the person updating is the owner. potentially change this to group membership.
            if (post.isVisitorOwner) {
                //do the update
                let status = await this.actuallyUpdate();
                resolve(status);
            } else {
                reject();
            }
        } catch {
            reject();
        }
    })
}

Post.prototype.cleanUp = function() {
    if (typeof(this.data.title) != "string") {this.data.title = ""}
    if (typeof(this.data.body) != "string") {this.data.body = ""}

    //elminate any unwanted properties (we only expect a title and body)
    this.data = {
        title: sanitizeHTML(this.data.title.trim(),{allowedTags: [], allowedAttributes: {}}),
        body: sanitizeHTML(this.data.body.trim(),{allowedTags: [], allowedAttributes: {}}),
        createdDate: new Date(),
        author: ObjectID(this.userid)
    }
}

Post.prototype.validate = function() {
    if (this.data.title ==="") {this.errors.push("You must provide a title.")}
    if (this.data.body ==="") {this.errors.push("You must provide some content.")}
}

Post.prototype.actuallyUpdate = function() {
    return new Promise(async (resolve, reject)=>{
        this.cleanUp();
        this.validate();
        if (!this.errors.length) {
            await postCollection.findOneAndUpdate({_id: new ObjectID(this.requestedPostId)}, {$set:{title: this.data.title, body: this.data.body}});
            resolve("success");
        } else {
            resolve("failure");

        }
    })
}

Post.reusablePostQuery = function(uniqueOperations, visitorId) {
    return new Promise(async function(resolve, reject) {
        let aggOperations = uniqueOperations.concat([
            {$lookup: {from: "users", localField: "author", foreignField: "_id", as: "authorDocument"}},
        {$project: {
            title: 1,
            body: 1,
            createdDate: 1,
            authorId: "$author",
            author: {$arrayElemAt: ["$authorDocument", 0]}
        }}
    ]);
    
    let posts = await postCollection.aggregate(aggOperations).toArray();

    //clean up author information
    posts = posts.map(function(post){
        post.isVisitorOwner = post.authorId.equals(visitorId);
///put code back here
        
        post.author = {
            username: post.author.username,
            avatar: new User(post.author, true).avatar
        }
        //what should this be???????
        post.authorId = undefined;
        
        return post;
    });

    resolve(posts);
});
}

Post.findSingleById = function(id, visitorId) {
    return new Promise(async function(resolve, reject) {
    if (typeof(id) != "string" || !ObjectID.isValid(id)) {
        reject();
        return
    } 
     let posts = await Post.reusablePostQuery([
         {$match: {_id: new ObjectID(id)}}
     ], visitorId);

    if (posts.length) {
       // console.log(posts[0]);
        resolve(posts[0]);
    } else {
        reject();
    }
    });
}

Post.findByAuthorId = function(authorId) {
    return Post.reusablePostQuery([
        {$match: {author: authorId}},
        {$sort: {createdDate: -1}}
    ]);
}
Post.delete = function (postToDelete, currentUserId) {
   return new Promise(async (resolve, reject) => {
       try {
        let post = await Post.findSingleById(postToDelete, currentUserId);
        console.log(post);
        if (post.isVisitorOwner) {
            await postCollection.deleteOne({_id: new ObjectID(postToDelete)});
            resolve();
        } else {
            reject();
        }
       } catch {
        reject();
       }
   }) 
}

Post.search = function(searchTerm) {
    return new Promise(async (resolve, reject) => {
        if (typeof(searchTerm) == "string") {
            let posts = await Post.reusablePostQuery([
                {$match: {$text: {$search: searchTerm}}},
                {$sort: {score: {$meta: "textScore"}}}
            ]);
            resolve(posts);
        } else {
            reject();
        }
    })
}

Post.countPostsByAuthor = function(id) {
    return new Promise(async(resolve, reject) =>{
        let postCount = await postCollection.countDocuments({author:id});
        resolve(postCount);
    })
}

Post.getFeed = async function(id) {
    //create an array of ids that the user is following
    let followedUsers = await  followsCollection.find({authorId: new ObjectID(id)}).toArray();
    followedUsers = followedUsers.map(function(followDoc){
        return followDoc.followedId;
    })
    //look for posts where the author is in the array
    return Post.reusablePostQuery([
        {$match: {author: {$in: followedUsers}}},
        {$sort: {createdDate: -1}}
    ]);
}

module.exports = Post;