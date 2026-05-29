import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuración de Firebase (Mantén tus credenciales reales aquí)
const firebaseConfig = {
  apiKey: "AIzaSyAzW2B3R_TxTojtp8Vw0iS3C2APO2Pmi5A",
  authDomain: "daesmi-8a93c.firebaseapp.com",
  projectId: "daesmi-8a93c",
  storageBucket: "daesmi-8a93c.firebasestorage.app",
  messagingSenderId: "298101414150",
  appId: "1:298101414150:web:294bcf5dd07f18a9cc6687"
};

// Inicializar Firebase y Servicios
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Estado Global de la Aplicación
let productos = [];
let combos = [];
let transacciones = [];
let idElementoEdicion = null;
let productosEnComboTemporal = [];
let filtroFechaActual = "mes"; 
let isAdmin = false;

// Al arrancar la página
document.addEventListener("DOMContentLoaded", () => {
    inicializarNavegacionYModales();
    inicializarAutenticacion();
    escucharDatosFirebase();
    configurarSelectoresFiltro();
});

// ========================================================
// 1. SISTEMA DE AUTENTICACIÓN (LOGIN CONTROL)
// ========================================================
function inicializarAutenticacion() {
    const btnEstadoSesion = document.getElementById("btn-estado-sesion");
    const txtEstadoSesion = document.getElementById("txt-estado-sesion");
    const formLogin = document.getElementById("form-login");
    const btnCancelLogin = document.getElementById("btn-cancelar-login");
    const btnCerrarSesion = document.getElementById("btn-cerrar-sesion");

    // Escuchar cambios de estado en la sesión
    onAuthStateChanged(auth, (user) => {
        if (user) {
            isAdmin = true;
            txtEstadoSesion.innerText = "Panel Admin";
            document.getElementById("nav-balance").classList.remove("hidden");
            document.getElementById("nav-ajustes").classList.remove("hidden");
            document.getElementById("wrapper-acciones-inventario").classList.remove("hidden");
            
            // Si el admin estaba en el login, redirigir a caja
            if (!document.getElementById("view-login").classList.contains("hidden")) {
                window.cambiarVistaEfectiva("view-balance", document.getElementById("nav-balance"));
            }
        } else {
            isAdmin = false;
            txtEstadoSesion.innerText = "Login";
            document.getElementById("nav-balance").classList.add("hidden");
            document.getElementById("nav-ajustes").classList.add("hidden");
            document.getElementById("wrapper-acciones-inventario").classList.add("hidden");
            window.cambiarVistaEfectiva("view-inventario", document.getElementById("nav-inventario"));
        }
        renderizarCatalogoTarjetas(); // Re-renderizar para ocultar/mostrar botones de edición
    });

    // Manejo del click en Login / Panel Superior
    if (btnEstadoSesion) {
        btnEstadoSesion.addEventListener("click", () => {
            if (isAdmin) {
                window.cambiarVistaEfectiva("view-ajustes", document.getElementById("nav-ajustes"));
            } else {
                window.cambiarVistaEfectiva("view-login", null);
            }
        });
    }

    if (btnCancelLogin) {
        btnCancelLogin.addEventListener("click", () => {
            window.cambiarVistaEfectiva("view-inventario", document.getElementById("nav-inventario"));
        });
    }

    // Procesar Formulario de Login
    if (formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim();
            const password = document.getElementById("login-password").value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                formLogin.reset();
            } catch (error) {
                console.error(error);
                alert("Credenciales inválidas. Por favor verifica tu correo y contraseña.");
            }
        });
    }

    // Procesar Cierre de Sesión
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", async () => {
            await signOut(auth);
            alert("Sesión cerrada correctamente.");
        });
    }
}

// ========================================================
// 2. ESCUCHA DE DATOS EN TIEMPE REAL (FIREBASE)
// ========================================================
function escucharDatosFirebase() {
    onSnapshot(query(collection(db, "productos"), orderBy("nombre")), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarSelectoresDeProductos();
        renderizarCatalogoTarjetas();
        verificarAlertasStock();
    });

    onSnapshot(query(collection(db, "combos"), orderBy("nombre")), (snapshot) => {
        combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarSelectoresDeProductos();
        renderizarCatalogoTarjetas();
    });

    onSnapshot(query(collection(db, "transacciones"), orderBy("timestamp", "desc")), (snapshot) => {
        transacciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        procesarYRenderizarBalance();
    });
}

// ========================================================
// 3. NAVEGACIÓN Y APERTURA DE MODALES
// ========================================================
function inicializarNavegacionYModales() {
    const btnBalance = document.getElementById("nav-balance");
    const btnInventario = document.getElementById("nav-inventario");
    const btnAjustes = document.getElementById("nav-ajustes");
    const botones = [btnBalance, btnInventario, btnAjustes];

    window.cambiarVistaEfectiva = function(vistaActivaId, bActivo) {
        document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
        const targetSection = document.getElementById(vistaActivaId);
        if (targetSection) targetSection.classList.remove("hidden");
        
        botones.forEach(b => { 
            if(b) {
                b.classList.remove("text-purple-800", "font-bold");
                b.classList.add("text-slate-400"); 
            }
        });
        if(bActivo) { 
            bActivo.classList.remove("text-slate-400");
            bActivo.classList.add("text-purple-800", "font-bold"); 
        }
    };

    if(btnBalance) btnBalance.addEventListener("click", () => cambiarVistaEfectiva("view-balance", btnBalance));
    if(btnInventario) btnInventario.addEventListener("click", () => cambiarVistaEfectiva("view-inventario", btnInventario));
    if(btnAjustes) btnAjustes.addEventListener("click", () => cambiarVistaEfectiva("view-ajustes", btnAjustes));

    const btnDashVenta = document.getElementById("btn-dash-venta");
    const btnDashCombo = document.getElementById("btn-dash-combo");
    if(btnDashVenta) btnDashVenta.addEventListener("click", () => abrirModalVenta());
    if(btnDashCombo) btnDashCombo.addEventListener("click", () => abrirModalCombo());

    const btnNuevoProd = document.getElementById("btn-nuevo-producto");
    const btnNuevoCombo = document.getElementById("btn-nuevo-combo");
    if(btnNuevoProd) btnNuevoProd.addEventListener("click", () => abrirModalProducto(null));
    if(btnNuevoCombo) btnNuevoCombo.addEventListener("click", () => abrirModalCombo(null));

    document.getElementById("btn-cerrar-modal-prod").addEventListener("click", () => cerrarModal("modal-producto"));
    document.getElementById("btn-cerrar-modal-combo").addEventListener("click", () => cerrarModal("modal-combo"));
    document.getElementById("btn-cerrar-modal-venta").addEventListener("click", () => cerrarModal("modal-venta"));

    // Guardar Producto
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
        cerrarModal("modal-producto");
    });

    // Guardar Combo
    document.getElementById("form-combo").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (productosEnComboTemporal.length === 0) return alert("Por favor, añade al menos un producto al kit.");
        const nombre = document.getElementById("combo-nombre").value.trim();
        const descripcion = document.getElementById("combo-descripcion").value.trim();
        const fotoUrl = document.getElementById("combo-foto").value.trim();
        const precioVenta = parseFloat(document.getElementById("combo-precio-venta").value) || 0;
        const costoTotal = productosEnComboTemporal.reduce((sum, p) => sum + (p.costo * p.cantidad), 0);

        const payload = { 
            nombre, descripcion, fotoUrl, precioVenta, costoTotal, 
            ganancia: precioVenta - costoTotal, productos: productosEnComboTemporal, activo: true 
        };

        if (idElementoEdicion) {
            await updateDoc(doc(db, "combos", idElementoEdicion), payload);
        } else {
            await addDoc(collection(db, "combos"), payload);
        }
        cerrarModal("modal-combo");
    });

    // Añadir item temporal al combo
    document.getElementById("btn-agregar-item-combo").addEventListener("click", () => {
        const select = document.getElementById("combo-select-producto");
        if (!select.value) return;
        const prod = productos.find(p => p.id === select.value);
        if (!prod) return;

        const existe = productosEnComboTemporal.find(p => p.id === prod.id);
        if (existe) { 
            existe.cantidad += 1; 
        } else { 
            productosEnComboTemporal.push({ id: prod.id, nombre: prod.nombre, costo: prod.costo, cantidad: 1 }); 
        }
        actualizarListaVisualCombo();
    });

    // Registrar Venta
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
            if (!prod || prod.stock < 1) return alert("¡Alerta! No quedan existencias de este producto.");
            
            await updateDoc(doc(db, "productos", cleanId), { stock: prod.stock - 1 });
            costoTotalVenta = prod.costo;
            nombreArticulo = prod.nombre;
        } else {
            const cleanId = itemId.replace("combo_", "");
            const combo = combos.find(c => c.id === cleanId);
            if (!combo) return;

            for (let item of combo.productos) {
                const orig = productos.find(p => p.id === item.id);
                if (!orig || orig.stock < item.cantidad) return alert(`Stock insuficiente del componente: ${item.nombre}`);
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

        cerrarModal("modal-venta");
    });

    document.getElementById("venta-select-item").addEventListener("change", (e) => {
        const val = e.target.value;
        let precio = 0;
        if (val.startsWith("prod_")) precio = productos.find(p => p.id === val.replace("prod_", ""))?.precio || 0;
        if (val.startsWith("combo_")) precio = combos.find(c => c.id === val.replace("combo_", ""))?.precioVenta || 0;
        document.getElementById("venta-precio-final").value = precio;
    });

    const btnCopy = document.getElementById("btn-copiar-copy");
    if(btnCopy) {
        btnCopy.addEventListener("click", () => {
            const tx = document.getElementById("mkt-texto-copy");
            if(!tx.value) return;
            navigator.clipboard.writeText(tx.value);
            alert("¡Texto comercial copiado al portapapeles! 📋");
        });
    }
}

// ========================================================
// 4. CONTROL DE MODALES AUXILIARES
// ========================================================
window.abrirModalProducto = function(id = null) {
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
    const modal = document.getElementById("modal-producto");
    modal.classList.replace("hidden", "flex");
}

window.abrirModalCombo = function(id = null) {
    idElementoEdicion = id;
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
    const modal = document.getElementById("modal-combo");
    modal.classList.replace("hidden", "flex");
}

function abrirModalVenta() {
    document.getElementById("form-venta").reset();
    document.getElementById("modal-venta").classList.replace("hidden", "flex");
}

function cerrarModal(idModal) {
    document.getElementById(idModal).classList.replace("flex", "hidden");
    idElementoEdicion = null;
}

// ========================================================
// 5. FILTROS Y BALANCE FINANCIERO
// ========================================================
function configurarSelectoresFiltro() {
    const btnHoy = document.getElementById("filtro-hoy");
    const btnSemana = document.getElementById("filtro-semana");
    const btnMes = document.getElementById("filtro-mes");

    const cambiarFiltroVisual = (filtro, btnActivo) => {
        filtroFechaActual = filtro;
        [btnHoy, btnSemana, btnMes].forEach(b => {
            if(b) {
                b.classList.remove("bg-purple-600", "text-white");
                b.classList.add("bg-slate-200", "text-slate-700");
            }
        });
        if(btnActivo) {
            btnActivo.classList.remove("bg-slate-200", "text-slate-700");
            btnActivo.classList.add("bg-purple-600", "text-white");
        }
        procesarYRenderizarBalance();
    };

    if(btnHoy) btnHoy.addEventListener("click", () => cambiarFiltroVisual("hoy", btnHoy));
    if(btnSemana) btnSemana.addEventListener("click", () => cambiarFiltroVisual("semana", btnSemana));
    if(btnMes) btnMes.addEventListener("click", () => cambiarFiltroVisual("mes", btnMes));
}

function cumpleFiltroFecha(timestamp) {
    const ahora = new Date();
    const fechaTransaccion = new Date(timestamp);

    if (filtroFechaActual === "hoy") {
        return ahora.toDateString() === fechaTransaccion.toDateString();
    } else if (filtroFechaActual === "semana") {
        return timestamp >= (Date.now() - (7 * 24 * 60 * 60 * 1000));
    } else if (filtroFechaActual === "mes") {
        return ahora.getMonth() === fechaTransaccion.getMonth() && ahora.getFullYear() === fechaTransaccion.getFullYear();
    }
    return true;
}

function procesarYRenderizarBalance() {
    let totalVentas = 0;
    let totalCostos = 0;
    let totalGanancias = 0;
    let totalDeudas = 0;

    const contenedorHistorial = document.getElementById("lista-transacciones");
    if(contenedorHistorial) contenedorHistorial.innerHTML = "";

    const transaccionesFiltradas = transacciones.filter(t => cumpleFiltroFecha(t.timestamp));

    transaccionesFiltradas.forEach(t => {
        if (t.estado === "pendiente") {
            totalDeudas += t.totalRecibido;
        } else {
            totalVentas += t.totalRecibido;
            totalCostos += t.costoReal;
            totalGanancias += t.gananciaLimpia;
        }

        if(contenedorHistorial) {
            const div = document.createElement("div");
            div.className = "bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex justify-between items-center text-xs";
            div.innerHTML = `
                <div>
                    <p class="font-bold text-slate-800">${t.articulo}</p>
                    <p class="text-[10px] text-slate-400">${t.fecha}</p>
                </div>
                <div class="text-right">
                    <p class="font-black ${t.estado === 'pendiente' ? 'text-amber-600' : 'text-emerald-600'}">$${t.totalRecibido.toLocaleString()}</p>
                    <span class="text-[9px] uppercase font-bold tracking-wider ${t.estado === 'pendiente' ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'} px-1.5 py-0.5 rounded-md">${t.estado}</span>
                </div>
            `;
            contenedorHistorial.appendChild(div);
        }
    });

    if(document.getElementById("bal-ganancia-neta")) document.getElementById("bal-ganancia-neta").innerText = `$${totalGanancias.toLocaleString()}`;
    if(document.getElementById("bal-total-ventas")) document.getElementById("bal-total-ventas").innerText = `+$${totalVentas.toLocaleString()}`;
    if(document.getElementById("bal-total-costos")) document.getElementById("bal-total-costos").innerText = `-$${totalCostos.toLocaleString()}`;
    if(document.getElementById("bal-total-deudas")) document.getElementById("bal-total-deudas").innerText = `$${totalDeudas.toLocaleString()}`;
    
    calcularTopProductos(transaccionesFiltradas);
}

function calcularTopProductos(listaTransacciones) {
    const conteo = {};
    listaTransacciones.forEach(t => { conteo[t.articulo] = (conteo[t.articulo] || 0) + 1; });

    const ordenados = Object.keys(conteo).map(name => ({
        nombre: name, ventas: conteo[name]
    })).sort((a, b) => b.ventas - a.ventas).slice(0, 3);

    const contenedorTop = document.getElementById("lista-top-productos");
    if(!contenedorTop) return;
    contenedorTop.innerHTML = "";
    
    if(ordenados.length === 0) {
        contenedorTop.innerHTML = `<p class="text-xs text-slate-400 italic">Sin movimientos en este rango.</p>`;
        return;
    }
    ordenados.forEach((item, index) => {
        contenedorTop.innerHTML += `
            <div class="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                <span class="text-slate-600 font-medium">${index + 1}. ${item.nombre}</span>
                <span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-[10px] font-black">${item.ventas} uds</span>
            </div>
        `;
    });
}

// ========================================================
// 6. ADAPTACIÓN DE RENDERIZADO DEL CATÁLOGO DE TARJETAS
// ========================================================
function renderizarCatalogoTarjetas() {
    const contenedor = document.getElementById("lista-inventario");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    // Unificar productos y combos en una sola vista limpia
    productos.forEach(p => {
        const div = document.createElement("div");
        div.className = "bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex gap-3 relative";
        div.innerHTML = `
            ${p.fotoUrl ? `<img src="${p.fotoUrl}" class="w-16 h-16 rounded-xl object-cover bg-slate-50">` : `<div class="w-16 h-16 rounded-xl bg-purple-50 flex items-center justify-center text-purple-400"><i data-lucide="image" class="w-6 h-6"></i></div>`}
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-slate-800 text-xs truncate">${p.nombre}</h4>
                <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5">${p.descripcion || 'Sin descripción comercial'}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-xs font-black text-purple-900">$${p.precio.toLocaleString()}</span>
                    <span class="text-[10px] font-bold ${p.stock <= 3 ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md' : 'text-slate-500'}">Stock: ${p.stock} u.</span>
                </div>
            </div>
            <div class="absolute top-3 right-3 flex gap-1">
                <button onclick="window.abrirPopUpMarketing('${p.id}', 'prod')" class="p-1 text-slate-400 hover:text-purple-700"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i></button>
                ${isAdmin ? `<button onclick="window.abrirModalProducto('${p.id}')" class="p-1 text-purple-600 hover:text-purple-900"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>` : ''}
            </div>
        `;
        contenedor.appendChild(div);
    });

    combos.forEach(c => {
        const div = document.createElement("div");
        div.className = "bg-gradient-to-r from-purple-50/50 to-pink-50/30 p-4 rounded-2xl border border-purple-100 shadow-xs flex gap-3 relative";
        div.innerHTML = `
            ${c.fotoUrl ? `<img src="${c.fotoUrl}" class="w-16 h-16 rounded-xl object-cover bg-white">` : `<div class="w-16 h-16 rounded-xl bg-purple-100 flex items-center justify-center text-purple-500"><i data-lucide="package" class="w-6 h-6"></i></div>`}
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1"><span class="bg-purple-600 text-white text-[8px] font-black uppercase px-1 rounded">Kit</span><h4 class="font-bold text-slate-800 text-xs truncate">${c.nombre}</h4></div>
                <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5">${c.descripcion || 'Kit de temporada seleccionado'}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-xs font-black text-purple-900">$${c.precioVenta.toLocaleString()}</span>
                    <span class="text-[9px] font-bold text-purple-600 bg-purple-100/50 px-1.5 py-0.5 rounded-md">Combo Ahorro</span>
                </div>
            </div>
            <div class="absolute top-3 right-3 flex gap-1">
                <button onclick="window.abrirPopUpMarketing('${c.id}', 'combo')" class="p-1 text-slate-400 hover:text-purple-700"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i></button>
                ${isAdmin ? `<button onclick="window.abrirModalCombo('${c.id}')" class="p-1 text-purple-600 hover:text-purple-900"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>` : ''}
            </div>
        `;
        contenedor.appendChild(div);
    });

    lucide.createIcons(); // Vuelve a renderizar todos los iconos en pantalla de forma segura
}

// ========================================================
// 7. PUBLICIDAD Y MARKETING COMERCIAL
// ========================================================
window.abrirPopUpMarketing = function(id, tipo) {
    let titulo = "", desc = "", precio = 0;
    
    if (tipo === 'prod') {
        const p = productos.find(prod => prod.id === id);
        if(p) { titulo = p.nombre; desc = p.descripcion || ""; precio = p.precio; }
    } else {
        const c = combos.find(com => com.id === id);
        if(c) { titulo = c.nombre; desc = c.descripcion || ""; precio = c.precioVenta; }
    }

    document.getElementById("mkt-preview-titulo").innerText = titulo;
    document.getElementById("mkt-preview-desc").innerText = desc;
    document.getElementById("mkt-preview-precio").innerText = `$${precio.toLocaleString()}`;

    // Construcción del copy comercial automático
    document.getElementById("mkt-texto-copy").value = `✨ ¡Miren este espectacular artículo disponible en DAESMI! ✨\n\n🛍️ *${titulo}*\n📝 ${desc}\n\n💵 *Precio imperdible:* $${precio.toLocaleString()} COP\n\nEscríbenos directamente para agendar tu pedido antes de que se agote. 💖📦`;

    const modalMkt = document.getElementById("modal-marketing");
    modalMkt.classList.remove("hidden");
    modalMkt.classList.add("flex");
    lucide.createIcons();
};

function verificarAlertasStock() {
    const contenedorAlertas = document.getElementById("contenedor-alertas-stock");
    if (!contenedorAlertas) return;

    // 1. Limpiar el contenido viejo de inmediato
    contenedorAlertas.innerHTML = "";

    // 2. 🌟 BLINDAJE: Si NO eres administrador, forzar el ocultamiento absoluto y salir
    if (!isAdmin) {
        contenedorAlertas.classList.add("hidden");
        return; 
    }

    // 3. Si eres administrador, evaluar el stock de los productos
    const criticos = productos.filter(p => p.stock <= 3);

    if (criticos.length === 0) {
        // Mostrar el mensaje verde SOLO al administrador
        contenedorAlertas.classList.remove("hidden");
        contenedorAlertas.innerHTML = `
            <div class="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-[11px] font-medium flex items-center gap-2 w-full">
                <span>✅ ¡Excelente! Todo tu inventario cuenta con buen stock.</span>
            </div>
        `;
        return;
    }

    // Si hay productos con bajo stock, mostrárselos al admin
    contenedorAlertas.classList.remove("hidden");
    criticos.forEach(p => {
        contenedorAlertas.innerHTML += `
            <div class="p-2.5 rounded-xl text-[11px] flex justify-between items-center w-full ${p.stock === 0 ? 'bg-rose-50 text-rose-900 border-l-4 border-rose-500' : 'bg-amber-50 text-amber-900 border-l-4 border-amber-500'}">
                <span>⚠️ <strong>${p.nombre}</strong> - Quedan solo ${p.stock} unidades.</span>
                <button onclick="window.abrirModalProducto('${p.id}')" class="underline font-bold hover:text-purple-800 ml-2">Surtir</button>
            </div>
        `;
    });
}

function actualizarSelectoresDeProductos() {
    const selectCombo = document.getElementById("combo-select-producto");
    const selectVenta = document.getElementById("venta-select-item");

    if (selectCombo) {
        selectCombo.innerHTML = `<option value="">-- Seleccionar Cosmético --</option>`;
        productos.forEach(p => {
            selectCombo.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
    }

    if (selectVenta) {
        selectVenta.innerHTML = `<option value="">-- Seleccionar Artículo --</option>`;
        
        const optGroupProd = document.createElement("optgroup");
        optGroupProd.label = "Productos Simples";
        productos.forEach(p => {
            optGroupProd.innerHTML += `<option value="prod_${p.id}">${p.nombre} [Stock: ${p.stock}]</option>`;
        });
        
        const optGroupCombo = document.createElement("optgroup");
        optGroupCombo.label = "Kits y Combos Armados";
        combos.forEach(c => {
            optGroupCombo.innerHTML += `<option value="combo_${c.id}">${c.nombre} ($${c.precioVenta.toLocaleString()})</option>`;
        });

        selectVenta.appendChild(optGroupProd);
        selectVenta.appendChild(optGroupCombo);
    }
}

function actualizarListaVisualCombo() {
    const lista = document.getElementById("combo-lista-productos-temporal");
    if(!lista) return;
    lista.innerHTML = "";
    
    let costoAcumulado = 0;
    productosEnComboTemporal.forEach((p, index) => {
        costoAcumulado += (p.costo * p.cantidad);
        lista.innerHTML += `
            <li class="flex justify-between items-center text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span>${p.nombre} (x${p.cantidad})</span>
                <button type="button" class="text-rose-500 hover:text-rose-700 font-bold" onclick="window.quitarItemComboTemporal(${index})">Eliminar</button>
            </li>
        `;
    });

    const infoCosto = document.getElementById("combo-costo-calculado");
    if(infoCosto) infoCosto.innerText = `$${costoAcumulado.toLocaleString()}`;
}

window.quitarItemComboTemporal = function(index) {
    productosEnComboTemporal.splice(index, 1);
    actualizarListaVisualCombo();
}
