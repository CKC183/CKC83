// ၁။ Firebase Config (သင့် Project ID marker1-6736f အတွက်)
const firebaseConfig = {
    apiKey: "AIzaSyD0oFN72HDNioauZHRyPd3Oh_I04abNgDs",
    authDomain: "marker1-6736f.firebaseapp.com",
    projectId: "marker1-6736f",
    storageBucket: "marker1-6736f.firebasestorage.app",
    messagingSenderId: "886941886218",
    appId: "1:886941886218:web:aac97e95f46682924ffcf3"
};

// ၂။ Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ၃။ API & Bot Settings
const IMGBB_API_KEY = "5501f0336d39021477b3b1acd38d8b43"; 
const botToken = "8515358728:AAGDeorFQbt1QGVOqHgr_Z7atlRHkoWRlPY";
const chatId = "7247933813";

let allProducts = [];
let selectedItem = null;

// --- Auth State Check ---
auth.onAuthStateChanged(user => {
    if (user) { loadProducts(); } 
    else { if (!window.location.pathname.includes("login.html")) window.location.href = "login.html"; }
});

// --- Product Loading & Display ---
function loadProducts() {
    db.collection("products").onSnapshot(snap => {
        allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filterProduct('All');
        updateCategoryButtons();
    });
}

function updateCategoryButtons() {
    const cats = ['အားလုံး', ...new Set(allProducts.map(p => p.category))];
    const catContainer = document.getElementById("cat-filter");
    if(catContainer) {
        catContainer.innerHTML = cats.map(c => 
            `<button class="cat-btn" onclick="filterProduct('${c === 'အားလုံး' ? 'All' : c}')">${c}</button>`
        ).join('');
    }
}

function filterProduct(cat) {
    const display = document.getElementById("product-display");
    if(!display) return;
    const filtered = (cat === 'All') ? allProducts : allProducts.filter(p => p.category === cat);
    display.innerHTML = filtered.map(p => `
        <div class="product-card shadow">
            <img src="${p.image}">
            <h4>${p.name}</h4>
            <p class="price-text">${p.price} MMK</p>
            <button class="btn-primary" onclick="openOrder('${p.name}', ${p.price})">ဝယ်ယူမည်</button>
        </div>
    `).join('');
}

// --- Order Modal Open ---
function openOrder(name, price) {
    selectedItem = { name, price };
    document.getElementById("selected-item-name").innerText = name;
    document.getElementById("selected-item-price").innerText = price;
    
    // အရေအတွက်ကို ၁ လို့ default ပြန်ထားပေးခြင်း
    if(document.getElementById("pQty")) document.getElementById("pQty").value = 1;
    
    document.getElementById("order-section").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- မှာယူခြင်း Logic (အသစ်ပြင်ထားသော အပိုင်း) ---
async function placeOrder() {
    const user = auth.currentUser;
    const phone = document.getElementById('custPhone').value;
    const addr = document.getElementById('custAddress').value;
    const qty = document.getElementById('pQty').value || 1; // အရေအတွက်ရွေးထားတာယူမယ်
    const fileInput = document.getElementById('payFile');
    const orderBtn = document.getElementById('orderBtn');

    if (!phone || !addr || !fileInput.files[0]) {
        return alert("အချက်အလက်နှင့် ပြေစာပုံ အပြည့်အစုံထည့်ပါ");
    }

    orderBtn.disabled = true;
    orderBtn.innerText = "ပုံတင်နေသည်...";

    // လက်ရှိ ရက်စွဲနှင့် အချိန်ကို မြန်မာစံတော်ချိန်ဖြင့် ယူခြင်း
    const now = new Date();
    const fullDate = now.toLocaleString('en-GB'); 

    try {
        // ၁။ ImgBB သို့ ပုံအရင်တင်ခြင်း
        const formData = new FormData();
        formData.append("image", fileInput.files[0]);

        const imgResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });
        
        const imgData = await imgResponse.json();

        if (imgData.success) {
            const imageUrl = imgData.data.url;
            const totalPrice = Number(selectedItem.price) * Number(qty); // စုစုပေါင်းစျေးတွက်ချက်ခြင်း

            // ၂။ Firebase Firestore ထဲ သိမ်းခြင်း
            await db.collection("orders").add({
                userId: user.uid,
                userEmail: user.email,
                itemName: selectedItem.name,
                price: selectedItem.price,
                quantity: Number(qty),
                total: totalPrice,
                phone: phone,
                address: addr,
                screenshot: imageUrl,
                status: "စစ်ဆေးနေဆဲ",
                date: fullDate
            });

            // ၃။ Telegram သို့ ပုံနှင့်စာ တွဲပို့ခြင်း (ဖုန်းနံပါတ် 09444787353 သို့ ပြောင်းထားပါသည်)
            const caption = `🛒 *Order အသစ်ရောက်ပါပြီ!*\n\n` +
                            `📅 ရက်စွဲ: ${fullDate}\n` +
                            `👤 ဝယ်သူ: ${user.email}\n` +
                            `📦 ပစ္စည်း: ${selectedItem.name}\n` +
                            `🔢 အရေအတွက်: ${qty} ခု\n` +
                            `💰 စုစုပေါင်းစျေး: ${totalPrice} MMK\n` +
                            `📞 ဖုန်း: ${phone}\n` +
                            `🏠 လိပ်စာ: ${addr}\n\n` +
                            `💳 *ငွေလွှဲဖုန်း: 09444787353*`;

            const telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
            const teleFormData = new FormData();
            teleFormData.append("chat_id", chatId);
            teleFormData.append("photo", imageUrl);
            teleFormData.append("caption", caption);
            teleFormData.append("parse_mode", "Markdown");

            await fetch(telegramUrl, { method: "POST", body: teleFormData });

            alert("မှာယူမှု အောင်မြင်ပါသည်။");
            closeOrder();
            location.reload(); 
        } else {
            throw new Error(imgData.error.message);
        }
    } catch (e) {
        alert("အမှားရှိပါသည်: " + e.message);
    } finally {
        orderBtn.disabled = false;
        orderBtn.innerText = "မှာယူမှုကို အတည်ပြုပါ";
    }
}

// --- UI Helpers ---
function toggleMenu() { document.getElementById("myDropdown").classList.toggle("show"); }
function closeOrder() { document.getElementById("order-section").classList.add("hidden"); }
function logout() { auth.signOut().then(() => location.href = "login.html"); }
