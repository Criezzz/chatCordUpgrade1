import express from "express";
import makepath from '../configs/path.js'

const router = express.Router();

router.get('/login', (req, res) => {
    res.sendFile(makepath("login.html"));
});

export default router;