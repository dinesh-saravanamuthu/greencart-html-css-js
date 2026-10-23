// GreenCart frontend - vanilla JS + Fetch API
const $ = (s) => document.querySelector(s);
const view = $('#view');
const money = (n) => '₹' + n.toLocaleString('en-IN');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  token: localStorage.getItem('gc_token'),
  user: JSON.parse(localStorage.getItem('gc_user') || 'null'),
  cart: JSON.parse(localStorage.getItem('gc_cart') || '[]'), // [{productId, qty}]
  products: [],
};
const saveCart = () => localStorage.setItem('gc_cart', JSON.stringify(state.cart));

function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), 2600);
}
// Static-only data layer: localStorage replaces the original Express API.
// This keeps the same UI and workflows without a server or framework.
const DB_KEY = 'gc_static_db';
const seedProducts = [
  ['Bananas','Fruits',45,60,'🍌','per dozen'],['Apples','Fruits',180,40,'🍎','per kg'],
  ['Mangoes','Fruits',120,25,'🥭','per kg'],['Tomatoes','Vegetables',30,80,'🍅','per kg'],
  ['Carrots','Vegetables',55,50,'🥕','per kg'],['Potatoes','Vegetables',35,90,'🥔','per kg'],
  ['Onions','Vegetables',40,70,'🧅','per kg'],['Spinach','Vegetables',25,30,'🥬','per bunch'],
  ['Milk','Dairy',28,100,'🥛','500 ml'],['Curd','Dairy',35,45,'🥣','400 g'],
  ['Butter','Dairy',58,35,'🧈','100 g'],['Eggs','Dairy',78,60,'🥚','tray of 12'],
  ['Bread','Bakery',40,40,'🍞','400 g loaf'],['Basmati Rice','Staples',110,50,'🍚','per kg'],
  ['Toor Dal','Staples',150,30,'🫘','per kg'],['Sunflower Oil','Staples',165,5,'🌻','1 litre'],
  ['Tea Powder','Beverages',120,40,'🍵','250 g'],['Orange Juice','Beverages',95,0,'🍊','1 litre']
];
function readDB() {
  let db;
  try { db = JSON.parse(localStorage.getItem(DB_KEY) || 'null'); } catch { db = null; }
  if (!db || !Array.isArray(db.products) || !Array.isArray(db.users) || !Array.isArray(db.orders)) {
    db = { nextProductId: 19, nextOrderId: 1001,
      users: [{id:1,name:'Store Admin',email:'admin@greencart.com',role:'admin',password:'admin123'}],
      products: seedProducts.map((p,i)=>({id:i+1,name:p[0],category:p[1],price:p[2],stock:p[3],emoji:p[4],unit:p[5]})), orders: [] };
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
  return db;
}
function writeDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function requireUser() {
  if (!state.token || !state.user) throw new Error('Please log in first.');
  const db = readDB();
  const user = db.users.find(u => u.id === state.user.id);
  if (!user) throw new Error('Please log in first.');
  return { db, user };
}
async function api(path, method = 'GET', body) {
  const verb = method.toUpperCase();
  let db = readDB();
  if (path === '/products' && verb === 'GET') return db.products.map(p => ({...p}));
  if (path === '/auth/register' && verb === 'POST') {
    const name = String(body?.name || '').trim(), email = String(body?.email || '').trim().toLowerCase(), password = String(body?.password || '');
    if (!name || !email || !password || password.length < 6) throw new Error('Name, email and a password of 6+ characters are required.');
    if (db.users.some(u => u.email === email)) throw new Error('That email is already registered.');
    const user = {id: Math.max(0,...db.users.map(u=>u.id))+1,name,email,role:'customer',password};
    db.users.push(user); writeDB(db);
    const safe = {id:user.id,name:user.name,role:user.role};
    return {token:'local-'+user.id+'-'+Date.now(),user:safe};
  }
  if (path === '/auth/login' && verb === 'POST') {
    const email = String(body?.email || '').trim().toLowerCase(), password = String(body?.password || '');
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error('Wrong email or password.');
    return {token:'local-'+user.id+'-'+Date.now(),user:{id:user.id,name:user.name,role:user.role}};
  }
  if (path === '/orders/mine' && verb === 'GET') {
    const {user} = requireUser();
    return db.orders.filter(o=>o.userId===user.id).reverse().map(o=>({...o,items:o.items.map(i=>({...i}))}));
  }
  if (path === '/orders' && verb === 'GET') {
    const {user} = requireUser(); if(user.role!=='admin') throw new Error('Admin access only.');
    return [...db.orders].reverse();
  }
  if (path === '/orders' && verb === 'POST') {
    const {user} = requireUser();
    const items=body?.items, address=String(body?.address||''), phone=String(body?.phone||'');
    if(!Array.isArray(items)||!items.length) throw new Error('Your cart is empty.');
    if(address.trim().length<8) throw new Error('Enter a full delivery address.');
    if(!/^\d{10}$/.test(phone)) throw new Error('Enter a 10-digit phone number.');
    const lines=[];
    for(const it of items){const p=db.products.find(x=>x.id===+it.productId),qty=Math.floor(+it.qty);if(!p||!(qty>0))throw new Error('An item in your cart is no longer available.');if(p.stock<qty)throw new Error(`Only ${p.stock} of ${p.name} left in stock.`);lines.push({productId:p.id,name:p.name,emoji:p.emoji,price:p.price,qty});}
    lines.forEach(l=>{db.products.find(p=>p.id===l.productId).stock-=l.qty;});
    const subtotal=lines.reduce((s,l)=>s+l.price*l.qty,0),delivery=subtotal>=500?0:30;
    const order={id:db.nextOrderId++,userId:user.id,customer:user.name,items:lines,subtotal,delivery,total:subtotal+delivery,address:address.trim(),phone,payment:'Cash on Delivery',status:'Placed',createdAt:new Date().toISOString()};
    db.orders.push(order);writeDB(db);return order;
  }
  if (path.startsWith('/orders/') && path.endsWith('/status') && verb === 'PATCH') {
    const {user}=requireUser();if(user.role!=='admin')throw new Error('Admin access only.');
    const id=+(path.split('/')[2]),o=db.orders.find(x=>x.id===id),statuses=['Placed','Packed','Out for delivery','Delivered','Cancelled'];
    if(!o)throw new Error('Order not found.');if(!statuses.includes(body?.status))throw new Error('Invalid status.');
    if(body.status==='Cancelled'&&o.status!=='Cancelled')o.items.forEach(l=>{const p=db.products.find(x=>x.id===l.productId);if(p)p.stock+=l.qty;});
    o.status=body.status;writeDB(db);return o;
  }
  const productMatch=path.match(/^\/products\/(\d+)$/);
  if(productMatch){const {user}=requireUser();if(user.role!=='admin')throw new Error('Admin access only.');const id=+productMatch[1],p=db.products.find(x=>x.id===id);
    if(verb==='POST'){} // route below handles collection POST
    if(verb==='PATCH'){if(!p)throw new Error('Product not found.');if(body.stock>=0)p.stock=+body.stock;if(body.price>0)p.price=+body.price;writeDB(db);return p;}
    if(verb==='DELETE'){db.products=db.products.filter(x=>x.id!==id);writeDB(db);return {ok:true};}
  }
  if(path==='/products'&&verb==='POST'){
    const {user}=requireUser();if(user.role!=='admin')throw new Error('Admin access only.');
    const name=String(body?.name||'').trim(),category=String(body?.category||'').trim(),price=+body?.price,stock=+body?.stock;
    if(!name||!category||!(price>0)||!(stock>=0))throw new Error('Name, category, price and stock are required.');
    const p={id:db.nextProductId++,name,category,price,stock,emoji:body.emoji||'🛒',unit:body.unit||'each'};db.products.push(p);writeDB(db);return p;
  }
  throw new Error('That action is not available in this static version.');
}
function setAuth(d) {
  state.token = d.token; state.user = d.user;
  localStorage.setItem('gc_token', d.token); localStorage.setItem('gc_user', JSON.stringify(d.user));
}
function logout(silent) {
  state.token = state.user = null; localStorage.removeItem('gc_token'); localStorage.removeItem('gc_user');
  if (!silent) toast('Logged out.'); location.hash = '#/login'; renderNav();
}

// ---------- nav ----------
function renderNav() {
  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  const u = state.user;
  $('#nav').innerHTML = `
    <a href="#/">Shop</a>
    ${u ? '<a href="#/orders">My orders</a>' : ''}
    ${u && u.role === 'admin' ? '<a href="#/admin">Admin</a>' : ''}
    <a href="#/cart" class="pill">Cart (${count})</a>
    ${u ? `<button id="lo">Log out (${esc(u.name.split(' ')[0])})</button>` : '<a href="#/login">Log in</a>'}`;
  if (u) $('#lo').onclick = () => logout();
}

// ---------- shop ----------
async function shop() {
  view.innerHTML = `<h1>Fresh groceries, delivered</h1><p class="sub">Search the catalog, add to cart and pay when it arrives.</p>
    <div class="bar"><input id="q" type="search" placeholder="Search products, e.g. tomato" aria-label="Search products">
    <select id="cat" aria-label="Category"><option value="">All categories</option></select></div><div id="list" class="grid"></div>`;
  const all = await api('/products');
  const cats = [...new Set(all.map((p) => p.category))];
  $('#cat').innerHTML += cats.map((c) => `<option>${c}</option>`).join('');
  const draw = () => {
    const q = $('#q').value.toLowerCase(), c = $('#cat').value;
    const list = all.filter((p) => p.name.toLowerCase().includes(q) && (!c || p.category === c));
    $('#list').innerHTML = list.length ? list.map(prodCard).join('') : '<div class="empty">No products match your search.</div>';
    document.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => addToCart(+b.dataset.add, all)));
  };
  $('#q').oninput = draw; $('#cat').onchange = draw; draw();
}
function prodCard(p) {
  const s = p.stock === 0 ? ['out', 'Out of stock'] : p.stock <= 10 ? ['low', `Only ${p.stock} left`] : ['ok', 'In stock'];
  return `<div class="card prod"><div class="em">${p.emoji}</div><div class="nm">${esc(p.name)}</div>
    <div class="un">${esc(p.unit)} · ${esc(p.category)}</div><div class="pr">${money(p.price)}</div>
    <div class="stock ${s[0]}">${s[1]}</div>
    <button class="btn" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>Add to cart</button></div>`;
}
function addToCart(id, products) {
  const p = products.find((x) => x.id === id), line = state.cart.find((i) => i.productId === id);
  if (line && line.qty >= p.stock) return toast(`Only ${p.stock} of ${p.name} available.`, true);
  line ? line.qty++ : state.cart.push({ productId: id, qty: 1 });
  saveCart(); renderNav(); toast(`${p.name} added to cart.`);
}

// ---------- cart + checkout ----------
async function cart() {
  const products = await api('/products');
  // drop items that no longer exist, cap to stock
  state.cart = state.cart.filter((i) => products.some((p) => p.id === i.productId))
    .map((i) => ({ ...i, qty: Math.min(i.qty, products.find((p) => p.id === i.productId).stock) })).filter((i) => i.qty > 0);
  saveCart(); renderNav();
  if (!state.cart.length) { view.innerHTML = '<div class="empty"><h1>Your cart is empty</h1><p>Add something fresh from the shop.</p><a class="btn" href="#/">Browse products</a></div>'; return; }
  const lines = state.cart.map((i) => ({ ...i, p: products.find((p) => p.id === i.productId) }));
  const sub = lines.reduce((s, l) => s + l.p.price * l.qty, 0), del = sub >= 500 ? 0 : 30;
  view.innerHTML = `<h1>Your cart</h1><p class="sub">Prices and stock are confirmed again when you place the order.</p>
  <div class="split"><div class="card">${lines.map((l) => `<div class="row"><span class="em">${l.p.emoji}</span>
    <div class="grow"><div><b>${esc(l.p.name)}</b></div><div class="small">${money(l.p.price)} · ${esc(l.p.unit)}</div></div>
    <div class="qty"><button data-dec="${l.productId}" aria-label="Decrease">−</button><span>${l.qty}</span><button data-inc="${l.productId}" aria-label="Increase">+</button></div>
    <b>${money(l.p.price * l.qty)}</b></div>`).join('')}</div>
  <div class="card"><h2>Delivery</h2>
    <div class="tot"><span>Subtotal</span><span>${money(sub)}</span></div>
    <div class="tot"><span>Delivery ${del ? '<span class="small">(free above ₹500)</span>' : ''}</span><span>${del ? money(del) : 'Free'}</span></div>
    <div class="tot big"><span>Total</span><span>${money(sub + del)}</span></div>
    <label for="addr">Delivery address</label><textarea id="addr" rows="3" placeholder="House no, street, area, city, pincode"></textarea>
    <label for="ph">Phone number</label><input id="ph" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number">
    <p class="small">Payment: Cash on Delivery</p>
    <button class="btn" id="place" style="width:100%">Place order</button></div></div>`;
  const change = (id, d) => { const l = state.cart.find((i) => i.productId === id), p = products.find((x) => x.id === id);
    l.qty += d; if (l.qty > p.stock) { l.qty = p.stock; toast(`Only ${p.stock} available.`, true); }
    if (l.qty <= 0) state.cart = state.cart.filter((i) => i !== l); saveCart(); cart(); };
  document.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => change(+b.dataset.inc, 1)));
  document.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = () => change(+b.dataset.dec, -1)));
  $('#place').onclick = async () => {
    if (!state.token) { toast('Log in to place your order.', true); location.hash = '#/login'; return; }
    try {
      const o = await api('/orders', 'POST', { items: state.cart, address: $('#addr').value, phone: $('#ph').value });
      state.cart = []; saveCart(); renderNav(); toast(`Order #${o.id} placed. Pay ${money(o.total)} on delivery.`); location.hash = '#/orders';
    } catch (e) { toast(e.message, true); }
  };
}

// ---------- auth page ----------
function login() {
  let mode = 'login';
  const draw = () => {
    view.innerHTML = `<div class="card auth"><div class="tabs"><button class="btn ${mode === 'login' ? '' : 'ghost'}" data-m="login">Log in</button>
    <button class="btn ${mode === 'register' ? '' : 'ghost'}" data-m="register">Register</button></div>
    ${mode === 'register' ? '<label for="n">Full name</label><input id="n" autocomplete="name">' : ''}
    <label for="e">Email</label><input id="e" type="email" autocomplete="email">
    <label for="p">Password</label><input id="p" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
    <button class="btn" id="go" style="width:100%;margin-top:16px">${mode === 'login' ? 'Log in' : 'Create account'}</button>
    <p class="small">Admin demo: admin@greencart.com / admin123</p></div>`;
    document.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { mode = b.dataset.m; draw(); }));
    $('#go').onclick = async () => {
      try {
        const d = await api('/auth/' + mode, 'POST', { name: $('#n')?.value, email: $('#e').value, password: $('#p').value });
        setAuth(d); renderNav(); toast(`Welcome, ${d.user.name}.`); location.hash = d.user.role === 'admin' ? '#/admin' : '#/';
      } catch (e) { toast(e.message, true); }
    };
  };
  draw();
}

// ---------- customer orders ----------
const badge = (s) => `<span class="badge ${s.split(' ')[0]}">${s}</span>`;
async function orders() {
  if (!state.token) return (location.hash = '#/login');
  const list = await api('/orders/mine');
  view.innerHTML = `<h1>My orders</h1><p class="sub">Track your orders from placement to delivery.</p>` +
    (list.length ? list.map((o) => `<div class="card order"><header><div><b>Order #${o.id}</b> <span class="small">${new Date(o.createdAt).toLocaleString()}</span></div>${badge(o.status)}</header>
      ${o.items.map((l) => `<div class="tot"><span>${l.emoji} ${esc(l.name)} × ${l.qty}</span><span>${money(l.price * l.qty)}</span></div>`).join('')}
      <div class="tot"><span>Delivery</span><span>${o.delivery ? money(o.delivery) : 'Free'}</span></div>
      <div class="tot big"><span>Total (Cash on Delivery)</span><span>${money(o.total)}</span></div>
      <p class="small">Deliver to: ${esc(o.address)} · ${esc(o.phone)}</p></div>`).join('')
      : '<div class="empty">No orders yet. <a href="#/">Start shopping</a></div>');
}

// ---------- admin ----------
async function admin() {
  if (!state.user || state.user.role !== 'admin') { toast('Admin access only.', true); return (location.hash = '#/'); }
  const [products, orders] = await Promise.all([api('/products'), api('/orders')]);
  const statuses = ['Placed', 'Packed', 'Out for delivery', 'Delivered', 'Cancelled'];
  view.innerHTML = `<h1>Admin dashboard</h1><p class="sub">${orders.length} orders · ${products.length} products</p>
  <div class="card" style="margin-bottom:20px"><h2>Add a product</h2><div class="form">
    <div><label for="an">Name</label><input id="an"></div><div><label for="ac">Category</label><input id="ac" list="cl"></div>
    <datalist id="cl">${[...new Set(products.map((p) => p.category))].map((c) => `<option>${c}</option>`).join('')}</datalist>
    <div><label for="ap">Price (₹)</label><input id="ap" type="number" min="1"></div><div><label for="as">Stock</label><input id="as" type="number" min="0"></div>
    <div><label for="au">Unit</label><input id="au" placeholder="per kg"></div><div><label for="ae">Emoji</label><input id="ae" placeholder="🛒" maxlength="4"></div>
    <button class="btn" id="add">Add product</button></div></div>
  <div class="card" style="margin-bottom:20px"><h2>Orders</h2><div class="scroll">${orders.length ? `<table><tr><th>#</th><th>Customer</th><th>Items</th><th>Total</th><th>Address</th><th>Status</th></tr>
    ${orders.map((o) => `<tr><td>${o.id}</td><td>${esc(o.customer)}<div class="small">${esc(o.phone)}</div></td>
    <td>${o.items.map((l) => `${esc(l.name)}×${l.qty}`).join(', ')}</td><td>${money(o.total)}</td><td>${esc(o.address)}</td>
    <td><select data-st="${o.id}" aria-label="Status for order ${o.id}">${statuses.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('')}</table>` : '<div class="empty">No orders yet.</div>'}</div></div>
  <div class="card"><h2>Catalog</h2><div class="scroll"><table><tr><th></th><th>Product</th><th>Price</th><th>Stock</th><th></th></tr>
    ${products.map((p) => `<tr><td>${p.emoji}</td><td>${esc(p.name)}<div class="small">${esc(p.category)} · ${esc(p.unit)}</div></td><td>${money(p.price)}</td>
    <td><input type="number" min="0" value="${p.stock}" data-stock="${p.id}" style="width:90px" aria-label="Stock for ${esc(p.name)}"></td>
    <td><button class="btn danger sm" data-del="${p.id}">Remove</button></td></tr>`).join('')}</table></div></div>`;
  const run = async (fn, ok) => { try { await fn(); toast(ok); admin(); } catch (e) { toast(e.message, true); } };
  $('#add').onclick = () => run(() => api('/products', 'POST', { name: $('#an').value.trim(), category: $('#ac').value.trim(), price: +$('#ap').value, stock: +$('#as').value, unit: $('#au').value.trim(), emoji: $('#ae').value.trim() }), 'Product added.');
  document.querySelectorAll('[data-st]').forEach((s) => (s.onchange = () => run(() => api(`/orders/${s.dataset.st}/status`, 'PATCH', { status: s.value }), 'Status updated.')));
  document.querySelectorAll('[data-stock]').forEach((i) => (i.onchange = () => run(() => api('/products/' + i.dataset.stock, 'PATCH', { stock: +i.value }), 'Stock updated.')));
  document.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => confirm('Remove this product?') && run(() => api('/products/' + b.dataset.del, 'DELETE'), 'Product removed.')));
}

// ---------- router ----------
const routes = { '': shop, '#/': shop, '#/cart': cart, '#/login': login, '#/orders': orders, '#/admin': admin };
async function route() {
  renderNav();
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === location.hash));
  try { await (routes[location.hash] || shop)(); } catch (e) { view.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', route);
route();
