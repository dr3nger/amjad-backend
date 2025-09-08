const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

// --- تهيئة Firebase Admin SDK ---
// سنقوم بجلب بيانات المفتاح السري من متغيرات البيئة في Railway لاحقًا
// هذا أكثر أمانًا من وضع الملف مباشرة في المشروع
const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();

// السماح بالطلبات من أي مصدر (ضروري ليتصل به التطبيق)
app.use(cors({ origin: true }));
app.use(express.json()); // للسماح باستقبال بيانات JSON

// دالة وسيطة للتحقق من هوية المستخدم
const checkAuth = async (req, res, next) => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        return res.status(403).send('Unauthorized');
    }
    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken; // إضافة بيانات المستخدم إلى الطلب
        next();
    } catch (error) {
        res.status(403).send('Unauthorized');
    }
};


// --- نقاط الوصول (API Endpoints) ---

// جلب كل المنتجات للمستخدم المسجل دخوله
app.get("/products", checkAuth, async (req, res) => {
    const userId = req.user.uid;
    try {
        const productsRef = db.collection(`users/${userId}/products`);
        const snapshot = await productsRef.orderBy("name").get();

        const products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json(products);
    } catch (error) {
        res.status(500).send("Error fetching products: " + error.message);
    }
});

// إضافة منتج جديد
app.post("/products", checkAuth, async (req, res) => {
    const userId = req.user.uid;
    const product = req.body; // البيانات القادمة من التطبيق
    try {
        await db.collection(`users/${userId}/products`).add(product);
        res.status(201).send({ message: "Product added successfully!" });
    } catch (error) {
        res.status(500).send("Error adding product: " + error.message);
    }
});


// قم بإضافة بقية الدوال (للمبيعات، الصيانة، إلخ) بنفس الطريقة

// تشغيل الخادم
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});