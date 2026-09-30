import mongoose from "mongoose";

 mongoose.connect("mongodb+srv://my_project:my_project@machine.dnmh3bw.mongodb.net/machine")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));


export default mongoose;