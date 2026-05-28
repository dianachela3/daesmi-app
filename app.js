// Importaciones de los módulos CDN de Firebase de forma directa
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Tu configuración real de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAzW2B3R_TxTojtp8Vw0iS3C2APO2Pmi5A",
  authDomain: "daesmi-8a93c.firebaseapp.com",
  projectId: "daesmi-8a93c",
  storageBucket: "daesmi-8a93c.firebasestorage.app",
  messagingSenderId: "298101414150",
  appId: "1:298101414150:web:294bcf5dd07f18a9cc6687"
};

// Inicializar instancias globales
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Estado de memoria local de la app
let productos = [];
let combos = [];
let transacciones = [];
let usuarioActual = null;
let productosEnComboTemporal = [];
let idElementoEdicion = null;

document.addEventListener("DOMContentLoaded", () => {
    escucharCambiosSesion();
    inicializarNavegacionYModales();
    escucharDatosEnTiempoReal();
});

// ==========================================
// CONTROL DE ACCESO, LOGIN Y VISTAS SEGÚN SESIÓN
// ==========================================
function escucharCambiosSesion() {
    onAuthStateChanged(auth, (user) => {
        usuarioActual = user;
        const btnSesion = document.getElementById("btn-estado-sesion");
        const txtSesion = document.getElementById("txt-estado-sesion");
        const navBalance = document.getElementById("nav-balance");
        const navAjustes = document.getElementById("nav-ajustes");
        const wrapperAcciones = document.getElementById("wrapper-acciones-inventario");
        
        if (user) {
            // Modo Administrador Desbloqueado
            txtSesion.textContent = "Admin";
            btnSesion.className = "bg-emerald-100 p-2 rounded-xl text-emerald-800 shadow-xs cursor-pointer flex items-center gap-1.5 text-xs font-bold";
            
            navBalance.classList.remove("hidden");
            navAjustes.classList.remove("hidden");
            wrapperAcciones.classList.remove("hidden");
            
            document.getElementById("titulo-catalogo").textContent = "Administración de Catálogo";
            document.getElementById("desc-catalogo").textContent = "Modifica existencias, costos y kits comerciales.";
        } else {
            // Modo Cliente / Público (Solo lectura)
            txtSesion.textContent = "Login";
            btnSesion.className = "bg-purple-100 p-2 rounded-xl text-purple-800 shadow-xs cursor-pointer flex items-center gap-1.5 text-xs font-bold";
            
            navBalance.classList.add("hidden");
            navAjustes.classList.add("hidden");
            wrapperAcciones.classList.add("hidden");
            
            document.getElementById("titulo-catalogo").textContent = "Catálogo Digital";
            document.getElementById("desc-catalogo").textContent = "Explora nuestros productos y kits exclusivos";
            
            // Si el cliente estaba en una sección privada, forzar regreso a catálogo
            cambiarVistaEfectiva("view-inventario", document.getElementById("nav-inventario"));
        }
        renderizarInventario();
        renderizarBalance();
    });

    // Evento click del botón superior de estado de sesión
    document.getElementById("btn-estado-sesion").addEventListener("click", () => {
        if (usuarioActual) {
            cambiarVistaEfectiva("view-ajustes", document.getElementById("nav-ajustes"));
        } else {
            document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
            document.getElementById("view-login").classList.remove("hidden");
        }
    });

    document.getElementById("btn-cancelar-login").addEventListener("click", () => {
        cambiarVistaEfectiva("view-inventario", document.getElementById("nav-inventario"));
    });

    // Procesar Login con Firebase Auth
    document.getElementById("form-login").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const pass = document.getElementById("login-password").value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            document.getElementById("form-login").reset();
            cambiarVistaEfectiva("view-inventario", document.getElementById("nav-inventario"));
        } catch (error) {
            alert("Error de autenticación. Verifica correo o contraseña.");
        }
    });

    // Procesar Cierre de Sesión
    document.getElementById("btn-cerrar-sesion").addEventListener("click", () => {
        signOut(auth);
    });
}

// ==========================================
// CONEXIÓN EN TIEMPO REAL CON FIRESTORE (SIN LOCALSTORAGE)
// ==========================================
function escucharDatosEnTiempoReal() {
    // Sincronizar Productos
    onSnapshot(collection(db, "productos"), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarSelectoresProducto();
        renderizarInventario();
        renderizarBalance();
    });

    // Sincronizar Combos
    onSnapshot(collection(db, "combos"), (snapshot) => {
        combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarInventario();
        renderizarBalance();
    });

    // Sincronizar Historial de Caja Ventas
    onSnapshot(collection(db, "transacciones"), (snapshot) => {
        transacciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ordenar por fecha descendente de forma local
        transacciones.sort((a,b) => b.timestamp - a.timestamp);
        renderizarBalance();
    });
}

// ==========================================
// LÓGICA DE NEGOCIO Y GUARDADO DE DATOS EN NUBE
// ==========================================
function inicializarNavegacionYModales() {
    const btnBalance = document.getElementById("nav-balance");
    const btnInventario = document.getElementById("nav-inventario");
    const btnAjustes = document.getElementById("nav-ajustes");
    const botones = [btnBalance, btnInventario, btnAjustes];

    window.cambiarVistaEfectiva = function(vistaActivaId, bActivo) {
        document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
        document.getElementById(vistaActivaId).classList.remove("hidden");
        botones.forEach(b => { b.classList.replace("text-purple-800", "text-slate-400"); b.classList.remove("font-bold"); });
        if(bActivo) { bActivo.classList.replace("text-slate-400", "text-purple-800"); bActivo.classList.add("font-bold"); }
    };

    btnBalance.addEventListener("click", () => cambiarVistaEfectiva("view-balance", btnBalance));
    btnInventario.addEventListener("click", () => cambiarVistaEfectiva("view-inventario", btnInventario));
    btnAjustes.addEventListener("click", () => cambiarVistaEfectiva("view-ajustes", btnAjustes));

    document.getElementById("btn-dash-venta").addEventListener("click", () => abrirModalVenta());
    document.getElementById("btn-dash-combo").addEventListener("click", () => abrirModalCombo());

    // Control de cierres de Modales
    document.getElementById("btn-cerrar-modal-prod").addEventListener("click", () => document.getElementById("modal-producto").classList.replace("flex", "hidden"));
    document.getElementById("btn-cerrar-modal-combo").addEventListener("click", () => document.getElementById("modal-combo").classList.replace("flex", "hidden"));
    document.getElementById("btn-cerrar-modal-venta").addEventListener("click", () => document.getElementById("modal-venta").classList.replace("flex", "hidden"));

    // Guardar/Editar Producto
    document.getElementById("form-producto").addEventListener("submit", async (e) => {
        e.preventDefault();
        const nombre = document.getElementById("prod-nombre").value.trim();
        const descripcion = document.getElementById("prod-descripcion").value.trim();
        const fotoUrl = document.getElementById("prod-foto").value.trim();
        const costo = parseFloat(document.getElementById("prod-costo").value) || 0;
        const precio = parseFloat(document.getElementById("prod-precio").value) || 0;
        const stock = parseInt(document.getElementById("prod-stock").value) || 0;

        const payload = { nombre, descripcion, fotoUrl, costo, precio, stock, activo: true };

        if (idElementoEdicion) {
            await updateDoc(doc(db, "productos", idElementoEdicion), payload);
        } else {
            await addDoc(collection(db, "productos"), payload);
        }
        document.getElementById("modal-producto").classList.replace("flex", "hidden");
    });

    // Guardar/Editar Combo
    document.getElementById("form-combo").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (productosEnComboTemporal.length === 0) return alert("Añade productos al kit.");
        const nombre = document.getElementById("combo-nombre").value.trim();
        const descripcion = document.getElementById("combo-descripcion").value.trim();
        const fotoUrl = document.getElementById("combo-foto").value.trim();
        const precioVenta = parseFloat(document.getElementById("combo-precio-venta").value) || 0;
        const costoTotal = productosEnComboTemporal.reduce((sum, p) => sum + (p.costo * p.cantidad), 0);

        const payload = { nombre, descripcion, fotoUrl, precioVenta, costoTotal, ganancia: precioVenta - costoTotal, productos: productosEnComboTemporal, activo: true };

        if (idElementoEdicion) {
            await updateDoc(doc(db, "combos", idElementoEdicion), payload);
        } else {
            await addDoc(collection(db, "combos"), payload);
        }
        document.getElementById("modal-combo").classList.replace("flex", "hidden");
    });

    // Agregar Item al Armador de Combo
    document.getElementById("btn-agregar-item-combo").addEventListener("click", () => {
        const select = document.getElementById("combo-select-producto");
        if (!select.value) return;
        const prod = productos.find(p => p.id === select.value);
        if (!prod) return;

        const existe = productosEnComboTemporal.find(p => p.id === prod.id);
        if (existe) { existe.cantidad += 1; } else { productosEnComboTemporal.push({ id: prod.id, nombre: prod.nombre, costo: prod.costo, cantidad: 1 }); }
        actualizarListaVisualCombo();
    });

    // Registrar Transacción Venta
    document.getElementById("form-venta").addEventListener("submit", async (e) => {
        e.preventDefault();
        const itemId = document.getElementById("venta-select-item").value;
        if (!itemId) return;

        const estado = document.getElementById("venta-estado-pago").value;
        const precioCobrado = parseFloat(document.getElementById("venta-precio-final").value) || 0;
        let costoTotalVenta = 0;
        let nombreArticulo = "";

        if (itemId.startsWith("prod_")) {
            const cleanId = itemId.replace("prod_", "");
            const prod = productos.find(p => p.id === cleanId);
            if (!prod || prod.stock < 1) return alert("Sin existencias suficientes.");
            
            await updateDoc(doc(db, "productos", cleanId), { stock: prod.stock - 1 });
            costoTotalVenta = prod.costo;
            nombreArticulo = prod.nombre;
        } else {
            const cleanId = itemId.replace("combo_", "");
            const combo = combos.find(c => c.id === cleanId);
            if (!combo) return;

            // Descontar inventarios cruzados
            for (let item of combo.productos) {
                const orig = productos.find(p => p.id === item.id);
                if (!orig || orig.stock < item.cantidad) return alert(`Stock insuficiente de ${item.nombre}`);
            }
            for (let item of combo.productos) {
                const orig = productos.find(p => p.id === item.id);
                await updateDoc(doc(db, "productos", item.id), { stock: orig.stock - item.cantidad });
            }
            costoTotalVenta = combo.costoTotal;
            nombreArticulo = `[Kit] ${combo.nombre}`;
        }

        await addDoc(collection(db, "transacciones"), {
            articulo: nombreArticulo,
            totalRecibido: precioCobrado,
            costoReal: costoTotalVenta,
            gananciaLimpia: precioCobrado - costoTotalVenta,
            estado,
            fecha: new Date().toLocaleString("es-CO", { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit', hour12: true }),
            timestamp: Date.now()
        });

        document.getElementById("modal-venta").classList.replace("flex", "hidden");
    });

    // Listener de precio sugerido en venta rápida
    document.getElementById("venta-select-item").addEventListener("change", (e) => {
        const val = e.target.value;
        let precio = 0;
        if (val.startsWith("prod_")) precio = productos.find(p => p.id === val.replace("prod_", ""))?.precio || 0;
        if (val.startsWith("combo_")) precio = combos.find(c => c.id === val.replace("combo_", ""))?.precioVenta || 0;
        document.getElementById("venta-precio-final").value = precio;
    });

    document.getElementById("btn-copiar-copy").addEventListener("click", () => {
        const tx = document.getElementById("mkt-texto-copy");
        tx.select();
        document.execCommand("copy");
        alert("¡Copy copiado de forma exitosa! 📋");
    });
}

// ==========================================
// RENDERIZADO VISUAL DINÁMICO E INTERFAZ
// ==========================================
function abrirModalProducto(id = null) {
    idElementoEdicion = id;
    const form = document.getElementById("form-producto");
    form.reset();
    if(id) {
        const p = productos.find(p => p.id === id);
        if(p) {
            document.getElementById("prod-nombre").value = p.nombre;
            document.getElementById("prod-descripcion").value = p.descripcion || "";
            document.getElementById("prod-foto").value = p.fotoUrl || "";
            document.getElementById("prod-costo").value = p.costo;
            document.getElementById("prod-precio").value = p.precio;
            document.getElementById("prod-stock").value = p.stock;
        }
    }
    document.getElementById("modal-producto").classList.replace("hidden", "flex");
}

function abrirModalCombo(id = null) {
    idElementionEdicion = id;
    document.getElementById("form-combo").reset();
    productosEnComboTemporal = [];
    actualizarListaVisualCombo();
    if(id) {
        const c = combos.find(cb => cb.id === id);
        if(c) {
            document.getElementById("combo-nombre").value = c.nombre;
            document.getElementById("combo-descripcion").value = c.descripcion || "";
            document.getElementById("combo-foto").value = c.fotoUrl || "";
            document.getElementById("combo-precio-venta").value = c.precioVenta;
            productosEnComboTemporal = [...c.productos];
            actualizarListaVisualCombo();
        }
    }
    document.getElementById("modal-combo").classList.replace("hidden", "flex");
}

function abrirModalVenta() {
    document.getElementById("form-venta").reset();
    const select = document.getElementById("venta-select-item");
    select.innerHTML = '<option value="">-- ¿Qué vendiste hoy? --</option>';
    
    if(combos.length > 0) {
        select.innerHTML += `<optgroup label="✨ KITS COMBOS">`;
        combos.filter(c => c.activo).forEach(c => select.innerHTML += `<option value="combo_${c.id}">${c.nombre} ($${c.precioVenta})</option>`);
    }
    if(productos.length > 0) {
        select.innerHTML += `<optgroup label="💄 INDIVIDUALES">`;
        productos.filter(p => p.activo && p.stock > 0).forEach(p => select.innerHTML += `<option value="prod_${p.id}">${p.nombre} (Dispo: ${p.stock})</option>`);
    }
    document.getElementById("modal-venta").classList.replace("hidden", "flex");
}

function actualizarSelectoresProducto() {
    const select = document.getElementById("combo-select-producto");
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    productos.filter(p => p.activo).forEach(p => select.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);
}

function actualizarListaVisualCombo() {
    const wrapper = document.getElementById("items-combo-agregados");
    wrapper.innerHTML = "";
    let cost = 0;
    productosEnComboTemporal.forEach((p, idx) => {
        cost += p.costo * p.cantidad;
        wrapper.innerHTML += `
            <div class="flex justify-between items-center bg-slate-100 p-2 rounded-lg text-[11px]">
                <span>${p.nombre} (x${p.cantidad})</span>
                <button type="button" onclick="window.eliminarItemTemporalCombo(${idx})" class="text-rose-500 font-bold px-1">✕</button>
            </div>`;
    });
    document.getElementById("combo-costo-calculado").textContent = `$${cost.toFixed(2)}`;
}

window.eliminarItemTemporalCombo = function(idx) { productosEnComboTemporal.splice(idx,1); actualizarListaVisualCombo(); };

function renderizarInventario() {
    const wrapper = document.getElementById("lista-inventario");
    if(!wrapper) return;
    wrapper.innerHTML = "";

    // Renderizar Combos / Kits
    if(combos.length > 0) {
        wrapper.innerHTML += `<h4 class="text-xs font-black uppercase text-purple-400 tracking-wider mt-2 mb-1">Combos Especiales</h4>`;
        combos.forEach(c => {
            if(!c.activo && !usuarioActual) return; // Ocultar inactivos a clientes
            wrapper.innerHTML += `
                <div class="p-4 rounded-xl border bg-white flex gap-3 ${!c.activo ? 'opacity-50' : ''}">
                    ${c.fotoUrl ? `<img src="${c.fotoUrl}" class="w-16 h-16 object-cover rounded-lg border">` : `<div class="w-16 h-16 bg-purple-50 text-purple-400 flex items-center justify-center rounded-lg"><i data-lucide="package"></i></div>`}
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-slate-800 text-sm">${c.nombre}</h4>
                        <p class="text-xs text-slate-400 truncate">${c.descripcion || 'Sin descripción comercial.'}</p>
                        <p class="text-xs font-black text-purple-700 mt-1">$${c.precioVenta.toFixed(2)}</p>
                        ${usuarioActual ? `
                            <p class="text-[10px] text-emerald-600 font-bold">Ganancia: +$${c.ganancia.toFixed(2)}</p>
                        ` : ''}
                    </div>
                    <div class="flex flex-col justify-between items-end">
                        <button onclick="window.lanzarMarketing('${c.id}', 'combo')" class="text-purple-600 bg-purple-50 p-1.5 rounded-lg border border-purple-100"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i></button>
                        ${usuarioActual ? `
                            <div class="flex gap-1 mt-2">
                                <button onclick="window.abrirEditarCombo('${c.id}')" class="text-slate-400"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                                <button onclick="window.eliminarComboNube('${c.id}')" class="text-rose-400"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                            </div>
                        ` : ''}
                    </div>
                </div>`;
        });
    }

    // Renderizar Productos Individuales
    if(productos.length > 0) {
        wrapper.innerHTML += `<h4 class="text-xs font-black uppercase text-slate-400 tracking-wider mt-4 mb-1">Maquillaje y Accesorios</h4>`;
        productos.forEach(p => {
            if(!p.activo && !usuarioActual) return;
            wrapper.innerHTML += `
                <div class="p-4 rounded-xl border bg-white flex gap-3 ${!p.activo ? 'opacity-50' : ''}">
                    ${p.fotoUrl ? `<img src="${p.fotoUrl}" class="w-16 h-16 object-cover rounded-lg border">` : `<div class="w-16 h-16 bg-slate-50 text-slate-400 flex items-center justify-center rounded-lg"><i data-lucide="box"></i></div>`}
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-slate-800 text-sm">${p.nombre}</h4>
                        <p class="text-xs text-slate-400 truncate">${p.descripcion || 'Sin descripción.'}</p>
                        <p class="text-xs font-black text-slate-800 mt-1">$${p.precio.toFixed(2)}</p>
                        ${usuarioActual ? `<p class="text-[10px] text-purple-600">Costo: $${p.costo.toFixed(2)}</p>` : ''}
                    </div>
                    <div class="flex flex-col justify-between items-end">
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${p.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">${p.stock} Und</span>
                        <div class="flex gap-1 mt-2">
                            <button onclick="window.lanzarMarketing('${p.id}', 'prod')" class="text-purple-600 p-1"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i></button>
                            ${usuarioActual ? `
                                <button onclick="window.abrirEditarProducto('${p.id}')" class="text-slate-400 p-1"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                                <button onclick="window.eliminarProductoNube('${p.id}')" class="text-rose-400 p-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                            ` : ''}
                        </div>
                    </div>
                </div>`;
        });
    }
    lucide.createIcons();
}

function renderizarBalance() {
    if(!usuarioActual) return; // Los clientes no ejecutan cálculos de caja
    let totalVentas = 0, totalCostos = 0, gananciaNetaReal = 0, totalPorCobrar = 0;

    transacciones.forEach(tx => {
        totalCostos += tx.costoReal;
        if (tx.estado === "pendiente") { totalPorCobrar += tx.totalRecibido; } 
        else { totalVentas += tx.totalRecibido; gananciaNetaReal += tx.gananciaLimpia; }
    });

    if(document.getElementById("bal-ganancia-neta")) document.getElementById("bal-ganancia-neta").textContent = `$${gananciaNetaReal.toFixed(2)}`;
    if(document.getElementById("bal-total-ventas")) document.getElementById("bal-total-ventas").textContent = `+$${totalVentas.toFixed(2)}`;
    if(document.getElementById("bal-total-costos")) document.getElementById("bal-total-costos").textContent = `-$${totalCostos.toFixed(2)}`;
    if(document.getElementById("bal-total-deudas")) document.getElementById("bal-total-deudas").textContent = `$${totalPorCobrar.toFixed(2)}`;

    const listaTx = document.getElementById("lista-transacciones");
    if(!listaTx) return;
    listaTx.innerHTML = "";

    transacciones.forEach(tx => {
        const esPendiente = tx.estado === "pendiente";
        listaTx.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs shadow-xs">
                <div>
                    <div class="flex items-center gap-1.5">
                        <p class="font-bold text-slate-800">${tx.articulo}</p>
                        <span class="text-[8px] font-extrabold px-1 rounded ${esPendiente ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">${tx.estado}</span>
                    </div>
                    <p class="text-[9px] text-slate-400">${tx.fecha}</p>
                </div>
                <div class="flex items-center gap-2">
                    <p class="font-bold ${esPendiente ? 'text-amber-600' : 'text-emerald-600'}">+$${tx.totalRecibido.toFixed(2)}</p>
                    <button onclick="window.eliminarTransaccionNube('${tx.id}')" class="text-rose-400 ml-1"><i data-lucide="trash" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>`;
    });
    lucide.createIcons();
}

// Mapeos globales de acciones en ventana para los botones inyectados en HTML
window.abrirEditarProducto = (id) => abrirModalProducto(id);
window.abrirEditarCombo = (id) => abrirModalCombo(id);
window.eliminarProductoNube = async (id) => { if(confirm("¿Eliminar producto?")) await deleteDoc(doc(db, "productos", id)); };
window.eliminarComboNube = async (id) => { if(confirm("¿Eliminar combo?")) await deleteDoc(doc(db, "combos", id)); };
window.eliminarTransaccionNube = async (id) => { if(confirm("¿Eliminar registro de venta?")) await deleteDoc(doc(db, "transacciones", id)); };

window.lanzarMarketing = function(id, tipo) {
    let t = "", d = "", p = 0;
    if(tipo === 'combo') {
        const c = combos.find(i => i.id === id); if(!c) return;
        t = c.nombre; p = c.precioVenta; d = c.descripcion || "¡Kit exclusivo de cosméticos seleccionados especialmente para ti!";
    } else {
        const pr = productos.find(i => i.id === id); if(!pr) return;
        t = pr.nombre; p = pr.precio; d = pr.descripcion || "Hermoso producto de nuestro catálogo. Calidad garantizada para resaltar tu belleza.";
    }
    document.getElementById("mkt-preview-titulo").textContent = t;
    document.getElementById("mkt-preview-desc").textContent = d;
    document.getElementById("mkt-preview-precio").textContent = `$${p.toFixed(2)}`;
    document.getElementById("mkt-texto-copy").value = `✨ ¡DISPONIBLE EN DAESMI! ✨\n\n🛍️ *${t}*\n\n${d}\n\n💵 *Precio:* $${p.toFixed(2)}\n\nEscríbenos para agendar el tuyo hoy mismo. 💕`;
    document.getElementById("modal-marketing").classList.replace("hidden", "flex");
    lucide.createIcons();
};
