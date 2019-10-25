const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");
const jwt = require('jsonwebtoken');

exports.login = (req, res) => {
  let user = new User(req.body);
  user
    .login()
    .then((result) => {
      req.session.user = { avatar: user.avatar, username: user.data.username, _id: user.data._id };
      req.session.save(function() {
        res.redirect("/");
      });
    })
    .catch(function(e) {
      req.flash("errors", e);
      req.session.save(function() {
        res.redirect("/");
      });
    });
};
exports.apiGetPostsByUsername = async function (req, res) {
  try{
    let authorDoc = await User.findByUsername(req.params.username);
    let posts = await Post.findByAuthorId(authorDoc._id);
    res.json(posts);
  } catch {
    res.json("That username could not be found.")
  }
}
exports.apiLogin = (req, res) => {
  let user = new User(req.body);
  user
    .login()
    .then((result) => {
      //jsonwebtoken -  three args -
      //a: data to store
      //b: secret string used when generated (pulled from ENV)
      //c: {} options as an object
  
      res.json(jwt.sign({_id: user.data._id},process.env.JWTSECRET,{expiresIn: '7d'}));
    })
    .catch(function(e) {
      res.json("Sorry, login failed. Please try again.")
    });
};
exports.doesUsernameExist = function(req, res) {
  User.findByUsername(req.body.username).then(function() {
    res.json(true);
  })
  .catch(function() {
    res.json(false);
  });
}
exports.doesEmailExist = async function(req, res) {
  let emailExists = await User.doesEmailExist(req.body.email);
  res.json(emailExists);
}
exports.logout = function(req, res) {
  req.session.destroy(function() {
    res.redirect("./");
  });
};

exports.register = function(req, res) {
  let user = new User(req.body);
  user
    .register()
    .then(() => {
        //put session data into session cookie. username, the avatar link to gravatar and the user id
      req.session.user = { avatar: user.avatar, username: user.data.username, _id: user.data._id };
      req.session.save(function() {
        res.redirect("/");
      });
    })
    .catch(regErrors => {
      regErrors.forEach(function(err) {
        req.flash("regErrors", err);
      });
      req.session.save(function() {
        res.redirect("/");
      });
    });
};

exports.sharedProfileData = async function(req, res, next) {
  let isFollowing = false;
  let isVisitorsProfile = false;
  if (req.session.user) {
    isVisitorsProfile = req.profileUser._id.equals(req.session.user._id);
//correct line....please put back.  checking for error
    isFollowing = await Follow.isVisitorFollowing(req.profileUser._id, req.visitorId);
   //error line
    //isFollowing = await Follow.isVisitorFollowing(req.params.username, req.visitorId);
  }
  req.isVisitorsProfile = isVisitorsProfile;
  req.isFollowing = isFollowing;
  //get the counts for posts followers and following
  
  let postCountPromise = Post.countPostsByAuthor(req.profileUser._id);
  let followerCountPromise = Follow.countFollowersById(req.profileUser._id);
  let followingCountPromise = Follow.countFollowingById(req.profileUser._id);
  let [postCount, followerCount, followingCount] = await Promise.all([postCountPromise, followerCountPromise, followingCountPromise]);
  req.postCount = postCount;
  req.followerCount = followerCount;
  req.followingCount = followingCount;

  next();
}

exports.home = async function(req, res) {
  if (req.session.user) {
    //fetch feed of posts for current user
    let posts = await Post.getFeed(req.session.user._id);
    res.render("home-dashboard", {posts: posts});
  } else {
    res.render("home-guest", {regErrors: req.flash("regErrors")});
  }
};

exports.mustBeLoggedIn = function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.flash("errors", "You must be logged in to perform that action.");
    req.session.save(function() {
      res.redirect("/");
    });
  }
};
exports.apiMustBeLoggedIn = function(req, res, next) {
  try {
    //check the token
    req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET);
    next();
  } catch {
    res.json("Invalid Token, please try again.")
  }
};

exports.ifUserExists = function(req, res, next) {
  User.findByUsername(req.params.username).then(function(userDoc) {
    req.profileUser = userDoc;
    next();
  }).catch(function() {
    res.render("404");
  });
  
}

exports.profilePostsScreen = function(req, res) {
  //get all posts by userid
  Post.findByAuthorId(req.profileUser._id).then(function(posts) {
    res.render('profile', {
      title: `${req.profileUser.username}'s Profile`,
      currentPage: "posts",
      posts: posts,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile,
      counts: {postCount:req.postCount, followerCount: req.followerCount, followingCount: req.followingCount}
    });

  }).catch(function() {
    res.render("404");
  });

  }

exports.profileFollowersScreen = async function(req, res) {
  try {
    let followers = await Follow.getFollowersById(req.profileUser._id);
    res.render('profile-followers', {
      title: `${req.profileUser.username}'s followers`,
      currentPage: "followers",
      followers: followers,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile,
      counts: {postCount:req.postCount, followerCount: req.followerCount, followingCount: req.followingCount}
    });
  } catch {
    res.render("404");
  }
}


exports.profileFollowingScreen = async function(req, res) {
  try {
    let following = await Follow.getFollowingById(req.profileUser._id);
    res.render('profile-following', {
      title: `${req.profileUser.username}'s is following`,
      currentPage: "following",
      following: following,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile,
      counts: {postCount:req.postCount, followerCount: req.followerCount, followingCount: req.followingCount}
    })
  } catch {
    res.render("404");
  }
}


