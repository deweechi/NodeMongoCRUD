const bcrypt = require("bcryptjs");
const usersCollection = require('../db').db().collection("users");
const validator = require("validator");
const md5 = require('md5');

let User = function(data, getAvatar) {
    this.data = data;
    this.errors = [];
    if (getAvatar == undefined) { getAvatar = false }
    if (getAvatar) {this.getAvatar()}

    
}

User.prototype.cleanUp = function() {
    if (typeof(this.data.username) != "string") {this.data.username = ""}
    if (typeof(this.data.email) != "string") {this.data.email = ""}
    if (typeof(this.data.password) != "string") {this.data.password = ""}

    //check for any additional properties
    this.data = {
        username: this.data.username.trim().toLowerCase(),
        email: this.data.email.trim().toLowerCase(),
        password: this.data.password
    }


}


User.prototype.validate = function(){
    return new Promise(async (resolve, reject) => {
        if (this.data.username == "") {this.errors.push("Please provide a username.")}
        if (this.data.username != "" && !validator.isAlphanumeric(this.data.username)) {this.errors.push("The username may only contain letters and numbers.")}
        if (!validator.isEmail(this.data.email)) {this.errors.push("Please provide an email address.")}
        if (this.data.password == "") {this.errors.push("Please provide a password.")}
        if (this.data.password.length > 0 && this.data.password.length < 10 ) {this.errors.push("The password must be at least 10 characters long.")}
        if (this.data.password.length > 50 ) {this.errors.push("The password cannot be more than 50 characters.")}
        if (this.data.username.length > 0 && this.data.username.length < 6 ) {this.errors.push("The username must be at least 6 characters long.")}
        if (this.data.username.length > 30 ) {this.errors.push("The username cannot be more than 30 characters.")}
        
        //check if username is already taken (if username has been entered)
        if(this.data.username.length>2 && this.data.username<31 && validator.isAlphanumeric(this.data.username)) {
            let usernameExists = await usersCollection.findOne({username: this.data.username});
            if (usernameExists) {this.errors.push("The username selected is already in use.")}
        }
    
        //check if email is already taken (if email has been entered)
        if(validator.isEmail(this.data.email)) {
            let emailExists = await usersCollection.findOne({email: this.data.email});
            if (emailExists) {this.errors.push("The email selected is already in use.")}
        }
        resolve();
    })
}

User.prototype.login = function() {
    return new Promise((resolve, reject)=>{
        this.cleanUp();
        usersCollection.findOne({username: this.data.username}).then((attemptedUser)=>{
            if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
                this.data = attemptedUser;
                this.getAvatar();
                resolve("good password");
            } else {
                reject("Incorrect Username or password.");
            }
        }).catch(function() {
            reject("Please try again later.");
        })
    })
}

User.prototype.register = function() {
    return new Promise(async (resolve, reject) => {
        //1. validate data
        this.cleanUp();
        await this.validate();
    
    
        //2. if no validation errors, save user data into db
        if (!this.errors.length) {
            //hash password
            let salt = bcrypt.genSaltSync(10);
            this.data.password = bcrypt.hashSync(this.data.password, salt);
            await usersCollection.insertOne(this.data);
            this.getAvatar();
            resolve();
        } else {
            reject(this.errors);
        }

    })
}

User.prototype.getAvatar = function() {
    this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`;
}

User.findByUsername = function(username) {
    return new Promise(function(resolve, reject){
       if(typeof(username) != "string") {
           reject();
           return
       } 
       usersCollection.findOne({username: username}).then(function(userDoc) { 
            if(userDoc) {
                userDoc = new User(userDoc, true);
                userDoc = {
                    _id: userDoc.data._id,
                    username: userDoc.data.username,
                    avatar: userDoc.avatar
                }
                resolve(userDoc); 
            } else {
                reject();
            }
       }).catch(function() {
           reject();
       })
    })
}
User.doesEmailExist = function(email) {
    return new Promise(async function(resolve, reject) {
        if (typeof(email) != "string") {
            resolve(false);
            return;
        }
        let user = await usersCollection.findOne({email:email});
        if(user) {
            resolve(true);
        } else {
            resolve(false);
        }
    })
}
module.exports = User;