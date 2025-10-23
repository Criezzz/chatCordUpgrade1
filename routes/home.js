import express from "express";
import makepath from '../configs/path.js'

const router = express.Router();

router.get('/', (req, res) => {
    res.sendFile(makepath("home.html"));
});


export default router;