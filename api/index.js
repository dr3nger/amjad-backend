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

const getCollectionItems = async (res, collectionRef) => {
  try {
    const snapshot = await collectionRef.get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(items);
  } catch (error) { res.status(500).send(error.message); }
};

// --- Products API ---
app.get("/products", checkAuth, (req, res) => getCollectionItems(res, db.collection(`users/${req.user.uid}/products`).orderBy("name")));
app.post("/products", checkAuth, async (req, res) => { try { await db.collection(`users/${req.user.uid}/products`).add(req.body); res.status(201).send({ message: "OK" }); } catch (e) { res.status(500).send(e.message); } });
app.put("/products/:id", checkAuth, async (req, res) => { try { await db.collection(`users/${req.user.uid}/products`).doc(req.params.id).set(req.body, { merge: true }); res.status(200).send({ message: "OK" }); } catch (e) { res.status(500).send(e.message); } });
app.delete("/products/:id", checkAuth, async (req, res) => { try { await db.collection(`users/${req.user.uid}/products`).doc(req.params.id).delete(); res.status(200).send({ message: "OK" }); } catch (e) { res.status(500).send(e.message); } });

// Endpoint خاص لعملية البيع
app.post("/products/:id/sell", checkAuth, async (req, res) => {
  const userId = req.user.uid;
  const productId = req.params.id;
  const { quantitySold, saleData } = req.body;
  const productRef = db.collection(`users/${userId}/products`).doc(productId);
  const salesRef = db.collection(`users/${userId}/sales`).doc();

  try {
    await db.runTransaction(async (t) => {
      const productDoc = await t.get(productRef);
      if (!productDoc.exists) { throw new Error("Product not found!"); }
      const currentQuantity = productDoc.data().quantity;
      if (currentQuantity < quantitySold) { throw new Error("Not enough stock!"); }
      t.update(productRef, { quantity: admin.firestore.FieldValue.increment(-quantitySold) });
      t.set(salesRef, saleData);
    });
    res.status(200).send({ message: "Sale successful!" });
  } catch (error) { res.status(500).send(error.message); }
});

// --- Sales API ---
app.get("/sales", checkAuth, (req, res) => getCollectionItems(res, db.collection(`users/${req.user.uid}/sales`).orderBy("saleDate", "desc")));

// Endpoint خاص للتراجع عن البيع
app.put("/sales/:id/undo", checkAuth, async (req, res) => {
  const userId = req.user.uid;
  const saleId = req.params.id;
  const { productId, quantitySold } = req.body;
  const saleRef = db.collection(`users/${userId}/sales`).doc(saleId);
  const productRef = db.collection(`users/${userId}/products`).doc(productId);

  try {
    await db.runTransaction(async (t) => {
      const saleDoc = await t.get(saleRef);
      if (!saleDoc.exists || saleDoc.data().isCancelled) { throw new Error("Sale not found or already undone!"); }
      t.update(saleRef, { isCancelled: true });
      t.update(productRef, { quantity: admin.firestore.FieldValue.increment(quantitySold) });
    });
    res.status(200).send({ message: "Undo successful!" });
  } catch (error) { res.status(500).send(error.message); }
});


// --- Purchases API ---
app.get("/purchases", checkAuth, (req, res) => getCollectionItems(res, db.collection(`users/${req.user.uid}/purchases`).orderBy("purchaseDate", "desc")));

// --- Repairs API ---
app.get("/repairs", checkAuth, (req, res) => getCollectionItems(res, db.collection(`users/${req.user.uid}/repair_orders`).orderBy("creationDate", "desc")));
app.post("/repairs", checkAuth, async (req, res) => { try { await db.collection(`users/${req.user.uid}/repair_orders`).add(req.body); res.status(201).send({ message: "OK" }); } catch (e) { res.status(500).send(e.message); } });
app.put("/repairs/:id", checkAuth, async (req, res) => { try { await db.collection(`users/${req.user.uid}/repair_orders`).doc(req.params.id).set(req.body, { merge: true }); res.status(200).send({ message: "OK" }); } catch (e) { res.status(500).send(e.message); } });
app.delete("/repairs/:id", checkAuth, async (req, res) => { try { await db.collection(`users/${req.user.uid}/repair_orders`).doc(req.params.id).delete(); res.status(200).send({ message: "OK" }); } catch (e) { res.status(500).send(e.message); } });

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));

module.exports = app;