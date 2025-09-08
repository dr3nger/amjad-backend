const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("The FIREBASE_SERVICE_ACCOUNT environment variable is not set.");
}
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

const checkAuth = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    return res.status(403).send('Unauthorized');
  }
  const idToken = req.headers.authorization.split('Bearer ')[1];
  try {
    req.user = await admin.auth().verifyIdToken(idToken);
    next();
  } catch (error) {
    res.status(403).send('Unauthorized');
  }
};

// --- دوال المنتجات ---
app.get("/products", checkAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const snapshot = await db.collection(`users/${userId}/products`).orderBy("name").get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(items);
  } catch (error) { res.status(500).send(error.message); }
});

app.post("/products", checkAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    await db.collection(`users/${userId}/products`).add(req.body);
    res.status(201).send({ message: "Product added!" });
  } catch (error) { res.status(500).send(error.message); }
});

app.put("/products/:id", checkAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    await db.collection(`users/${userId}/products`).doc(req.params.id).set(req.body, { merge: true });
    res.status(200).send({ message: "Product updated!" });
  } catch (error) { res.status(500).send(error.message); }
});

app.delete("/products/:id", checkAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    await db.collection(`users/${userId}/products`).doc(req.params.id).delete();
    res.status(200).send({ message: "Product deleted!" });
  } catch (error) { res.status(500).send(error.message); }
});


// --- يمكنك إضافة بقية الدوال للمبيعات والصيانة بنفس الطريقة ---


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));

module.exports = app;