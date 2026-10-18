require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mindchamps_portal";
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch(err => console.error("MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  role: { type: String, required: true, enum: ["admin", "teacher", "student"] },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  studentNumber: String,
  gradeLevel: String,
  level: String,
  guardianName: String,
  guardianContactNumber: String,
  address: String,
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const classSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  subject: String,
  level: String,
  room: String,
  schedule: String,
  teacherId: String,
  students: { type: Array, default: [] },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const recordSchema = new mongoose.Schema({
  classId: { type: String, required: true },
  date: { type: String, required: true },
  entries: { type: Array, default: [] },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const archiveSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  ownerId: String,
  classId: String,
  className: String,
  start: String,
  end: String,
  rows: { type: Array, default: [] },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const User = mongoose.model("User", userSchema);
const Class = mongoose.model("Class", classSchema);
const Record = mongoose.model("Record", recordSchema);
const Archive = mongoose.model("Archive", archiveSchema);

app.get("/api/data", async (req, res) => {
  try {
    let users = await User.find({}, { _id: 0, __v: 0 });
    let classes = await Class.find({}, { _id: 0, __v: 0 });
    let records = await Record.find({}, { _id: 0, __v: 0 });
    let archives = await Archive.find({}, { _id: 0, __v: 0 });

    if (users.length === 0) {
      const defaultAdmin = {
        id: "admin-1",
        role: "admin",
        name: "School Administrator",
        email: "admin@mindchamps.local",
        password: "Admin123!"
      };
      await User.create(defaultAdmin);
      users = [defaultAdmin];
    }

    res.json({ users, classes, records, archives });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/data", async (req, res) => {
  try {
    const { users, classes, records, archives } = req.body;

    if (Array.isArray(users)) {
      for (let user of users) {
        await User.findOneAndUpdate({ id: user.id }, user, { upsert: true, new: true });
      }
    }

    if (Array.isArray(classes)) {
      for (let cls of classes) {
        await Class.findOneAndUpdate({ id: cls.id }, cls, { upsert: true, new: true });
      }
    }

    if (Array.isArray(records)) {
      for (let rec of records) {
        await Record.findOneAndUpdate({ classId: rec.classId, date: rec.date }, rec, { upsert: true, new: true });
      }
    }

    if (Array.isArray(archives)) {
      for (let arch of archives) {
        await Archive.findOneAndUpdate({ id: arch.id }, arch, { upsert: true, new: true });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));