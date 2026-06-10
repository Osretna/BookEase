import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Load Firebase configuration
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.error("firebase-applet-config.json is missing! Please complete Firebase setup.");
    process.exit(1);
  }
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // Initialize Firebase server-side SDK
  const firebaseApp = initializeApp(firebaseConfig);
  const db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(firebaseApp);

  // Bootstrap Admin in Firestore on start (failsafe)
  try {
    const adminRef = doc(db, "users", "admin");
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, {
        uid: "admin",
        username: "admin",
        role: "admin",
        phone: "+201000000000",
        password: "admin1234",
        requiresPasswordChange: false,
        createdAt: new Date().toISOString()
      });
      console.log("Admin account bootstrapped in Firestore.");
    }
  } catch (err) {
    console.warn("Could not check/bootstrap admin account in Firestore: ", err);
  }

  // --- API Routes ---

  // 1. Authentication Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and Password are required" });
      }

      // Special case: direct check for bootstrap
      if (username === "admin" && password === "admin1234") {
        return res.json({
          user: {
            uid: "admin",
            username: "admin",
            role: "admin",
            phone: "+201000000000"
          },
          requiresPasswordChange: false
        });
      }

      // Query from users collection
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      if (userData.password !== password) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Return credentials or password renewal demand
      if (userData.requiresPasswordChange) {
        return res.json({
          requiresPasswordChange: true,
          uid: userData.uid || userDoc.id,
          username: userData.username
        });
      }

      return res.json({
        user: {
          uid: userData.uid || userDoc.id,
          username: userData.username,
          role: userData.role,
          phone: userData.phone || ""
        },
        requiresPasswordChange: false
      });
    } catch (error: any) {
      console.error("Login route error: ", error);
      res.status(500).json({ error: error.message || "Server Error" });
    }
  });

  // 2. Change Password (Mandatory update on first-time login)
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { uid, newPassword } = req.body;
      if (!uid || !newPassword) {
        return res.status(400).json({ error: "User ID and New Password are required" });
      }

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return res.status(404).json({ error: "User not found" });
      }

      await updateDoc(userRef, {
        password: newPassword,
        requiresPasswordChange: false
      });

      const updatedData = (await getDoc(userRef)).data();

      return res.json({
        success: true,
        user: {
          uid: updatedData?.uid,
          username: updatedData?.username,
          role: updatedData?.role,
          phone: updatedData?.phone
        }
      });
    } catch (error: any) {
      console.error("Change password error: ", error);
      res.status(500).json({ error: error.message || "Server Error" });
    }
  });

  // 3. Create Chalet Owner (User) directly from application (No Firebase console required!)
  app.post("/api/users/create", async (req, res) => {
    try {
      const { username, password, phone, role } = req.body;
      if (!username || !password || !phone) {
        return res.status(400).json({ error: "Username, initial password and phone are required" });
      }

      // Check if username already exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username.trim()));
      const existingUsers = await getDocs(q);

      if (!existingUsers.empty) {
        return res.status(400).json({ error: "This username is already registered" });
      }

      // Generate random unique ID
      const newUid = "owner_" + Math.random().toString(36).substring(2, 15);
      const userDocRef = doc(db, "users", newUid);

      await setDoc(userDocRef, {
        uid: newUid,
        username: username.trim(),
        password: password,
        phone: phone.trim(),
        role: role || "owner",
        requiresPasswordChange: true, // Forces first login password reset
        createdAt: new Date().toISOString()
      });

      return res.status(201).json({
        success: true,
        user: {
          uid: newUid,
          username: username.trim(),
          phone: phone.trim(),
          role: role || "owner"
        }
      });
    } catch (error: any) {
      console.error("Create user error: ", error);
      res.status(500).json({ error: error.message || "Server Error" });
    }
  });

  // 4. List all users (For the administrator page)
  app.get("/api/users", async (req, res) => {
    try {
      const usersRef = collection(db, "users");
      const listSnapshot = await getDocs(usersRef);
      const users = listSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          username: data.username,
          role: data.role,
          phone: data.phone || "",
          requiresPasswordChange: data.requiresPasswordChange || false,
          createdAt: data.createdAt || ""
        };
      });

      // Filter out admin details or keep them
      res.json({ users });
    } catch (error: any) {
      console.error("List users error: ", error);
      res.status(500).json({ error: error.message || "Server Error" });
    }
  });

  // 5. Delete specific Owner
  app.delete("/api/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      if (!uid) {
        return res.status(400).json({ error: "User ID is required" });
      }

      await deleteDoc(doc(db, "users", uid));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete user error: ", error);
      res.status(500).json({ error: error.message || "Server Error" });
    }
  });

  // --- Serve Frontend Application via Vite ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Porto South Beach Server running on http://localhost:${PORT}`);
  });
}

startServer();
