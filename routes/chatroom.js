import express from "express";
import makepath from '../configs/path.js'

const router = express.Router();

router.get('/chat', (req, res) => {
    res.sendFile(makepath("chat.html"));
});

export default router;