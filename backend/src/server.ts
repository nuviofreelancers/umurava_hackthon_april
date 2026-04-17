import express from "express";
import { connectDB } from "../config/db";
import dotenv from "dotenv";
import userRouter from "../routes/authRoutes";
import jobRouter from "../routes/jobRoutes";
import applicationRouter from "../routes/applicantRoutes";
import screeningRouter from "../routes/screeningRoutes";
dotenv.config();



const app = express();
app.use(express.json());
const PORT = 3000;


connectDB()


app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});
app.use("/api/users", userRouter)
app.use("/api/jobs", jobRouter)
app.use("/api/applications", applicationRouter)
app.use("/api/screening", screeningRouter)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});