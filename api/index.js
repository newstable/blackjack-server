const express = require("express");
const router = express.Router();
const User = require("./api_controller");

module.exports = (router) => {
    // User API
    router.post("/start-BlackJack", User.StartGame);
    router.post("/Hit", User.Hit);
    router.post("/Stand", User.Stand);
    router.post("/Split", User.Split);
    router.post("/Double", User.Double);
    router.post("/Insurance", User.Insurance);
    router.post("/Forfiet", User.Forfiet);
};
