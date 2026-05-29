import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, deleteDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuración de Firebase
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
let carrito = JSON.parse(localStorage.getItem("daesmi_carrito")) || [];
let idElementoEdicion = null;
let productosEnComboTemporal = [];
let filtroFechaActual = "mes"; 
let categoriaSeleccionada = "todos";
let isAdmin = false;
let alertasOcultasTemporalmente = [];
let capitalBaseFijo = 0;
let retirosAcumulados = 0;
const WHATSAPP_NUMERO = "573022152560"; // Configuración del canal de atención DAESMI

// Al arrancar la página
document.addEventListener("DOMContentLoaded", () => {
    inicializarNavegacionYModales();
    inicializarAutenticacion();
    escucharDatosFirebase();
    configurarSelectoresFiltro();
    inicializarManejadoresCarrito();
    actualizarBadgeCarritoVisual();
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

    onAuthStateChanged(auth, (user) => {
        if (user) {
            isAdmin = true;
            txtEstadoSesion.innerText = "Panel Admin";
            document.getElementById("nav-balance").classList.remove("hidden");
            document.getElementById("nav-ajustes").classList.remove("hidden");
            document.getElementById("wrapper-acciones-inventario").classList.remove("hidden");
            
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
        renderizarCatalogoTarjetas();
        verificarAlertasStock();
    });

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

    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", async () => {
            await signOut(auth);
            alert("Sesión cerrada correctamente.");
        });
    }
}

// ========================================================
// 2. ESCUCHA DE DATOS EN TIEMPO REAL (FIREBASE)
// ========================================================
function escucharDatosFirebase() {
    onSnapshot(query(collection(db, "productos"), orderBy("nombre")), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarSelectoresDeProductos();
        renderizarCatalogoTarjetas();
        verificarAlertasStock();
        renderizarCategoriasNavegacion();
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

    onSnapshot(doc(db, "configuracion", "caja_daesmi"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            capitalBaseFijo = data.capitalBase || 0;
            retirosAcumulados = data.retiros || 0;
        } else {
            setDoc(doc(db, "configuracion", "caja_daesmi"), { capitalBase: 0, retiros: 0 });
        }
        if (transacciones.length > 0) {
            procesarYRenderizarBalance();
        }
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

    // Guardar Producto (Incluyendo categoría de forma dinámica)
    document.getElementById("form-producto").addEventListener("submit", async (e) => {
        e.preventDefault();
        const nombre = document.getElementById("prod-nombre").value.trim();
        const descripcion = document.getElementById("prod-descripcion").value.trim();
        const fotoUrl = document.getElementById("prod-foto").value.trim();
        const costo = parseFloat(document.getElementById("prod-costo").value) || 0;
        const precio = parseFloat(document.getElementById("prod-precio").value) || 0;
        const stock = parseInt(document.getElementById("prod-stock").value) || 0;
        const categoria = document.getElementById("prod-categoria").value.trim() || "General";

        const payload = { nombre, descripcion, fotoUrl, costo, precio, stock, categoria, activo: true };

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
            productosEnComboTemporal.push({ 
                id: prod.id, 
                nombre: prod.nombre, 
                costo: prod.costo, 
                precioIndividual: prod.precio,
                cantidad: 1 
            }); 
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
    
        const asumioEnvioRadio = document.querySelector('input[name="asumio-envio"]:checked')?.value || "no";
        let envioAsumido = 0;
        if (asumioEnvioRadio === "si") {
            envioAsumido = parseFloat(document.getElementById("venta-envio-asumido").value) || 0;
        }
    
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
    
        const gananciaCalculada = (precioCobrado - costoTotalVenta) - envioAsumido;
    
        await addDoc(collection(db, "transacciones"), {
            articulo: nombreArticulo,
            totalRecibido: precioCobrado,
            costoReal: costoTotalVenta,
            envioAsumido: envioAsumido,
            gananciaLimpia: gananciaCalculada,
            estado,
            fecha: new Date().toLocaleString("es-CO", { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit', hour12: true }),
            timestamp: Date.now()
        });
    
        if (document.getElementById("venta-envio-asumido")) {
            document.getElementById("venta-envio-asumido").value = "0";
            document.getElementById("contenedor-envio-asumido").classList.add("hidden");
            const radioNo = document.querySelector('input[name="asumio-envio"][value="no"]');
            if (radioNo) radioNo.checked = true;
        }
    
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
            document.getElementById("prod-categoria").value = p.categoria || "General";
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
            totalGanancias += (t.gananciaLimpia !== undefined) ? t.gananciaLimpia : (t.totalRecibido - t.costoReal);
        }

        if(contenedorHistorial) {
            const div = document.createElement("div");
            div.className = "bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex justify-between items-center text-xs gap-2 cursor-pointer hover:bg-purple-50/40 transition-all";
            div.onclick = () => window.abrirDetalleReciboVenta(t.id);
            div.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-slate-800 truncate">${t.articulo}</p>
                    <p class="text-[10px] text-slate-400">${t.fecha}</p>
                </div>
                <div class="text-right flex items-center gap-2" onclick="event.stopPropagation();">
                    <div>
                        <p class="font-black ${t.estado === 'pendiente' ? 'text-amber-600' : 'text-emerald-600'}">$${t.totalRecibido.toLocaleString()}</p>
                        <span class="text-[9px] uppercase font-bold tracking-wider ${t.estado === 'pendiente' ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'} px-1.5 py-0.5 rounded-md">${t.estado}</span>
                    </div>
                    ${isAdmin ? `
                        <button onclick="window.eliminarVentaInteligente('${t.id}', '${t.articulo}')" class="p-1 text-rose-400 hover:text-rose-600 ml-1" title="Eliminar Venta">
                            ✕
                        </button>
                    ` : ''}
                </div>
            `;
            contenedorHistorial.appendChild(div);
        }
    });

    if(document.getElementById("bal-ganancia-neta")) document.getElementById("bal-ganancia-neta").innerText = `$${totalGanancias.toLocaleString()}`;
    if(document.getElementById("bal-total-ventas")) document.getElementById("bal-total-ventas").innerText = `+$${totalVentas.toLocaleString()}`;
    if(document.getElementById("bal-total-costos")) document.getElementById("bal-total-costos").innerText = `-$${totalCostos.toLocaleString()}`;
    if(document.getElementById("bal-total-deudas")) document.getElementById("bal-total-deudas").innerText = `$${totalDeudas.toLocaleString()}`;
    
    const utilidadLibre = totalGanancias - retirosAcumulados;
    const efectivoTotalCaja = capitalBaseFijo + utilidadLibre;

    if(document.getElementById("caja-capital-base")) document.getElementById("caja-capital-base").innerText = `$${capitalBaseFijo.toLocaleString()}`;
    if(document.getElementById("caja-ganancia-libre")) document.getElementById("caja-ganancia-libre").innerText = `$${utilidadLibre.toLocaleString()}`;
    if(document.getElementById("caja-efectivo-total")) document.getElementById("caja-efectivo-total").innerText = `$${efectivoTotalCaja.toLocaleString()}`;
    
    // Calcular analítica de rotación interna (Top 3 de más vendidos)
    calcularTopProductosPublico();
}

// ========================================================
// 🌟 OBSERVACIÓN 3: TOP 3 MÁS VENDIDOS PARA CLIENTES
// ========================================================
function calcularTopProductosPublico() {
    const conteo = {};
    transacciones.forEach(t => { 
        if (t.estado !== "pendiente") {
            conteo[t.articulo] = (conteo[t.articulo] || 0) + 1; 
        }
    });

    const ordenados = Object.keys(conteo).map(name => ({
        nombre: name.replace("[Kit] ", ""),
        ventas: conteo[name],
        esKit: name.startsWith("[Kit]")
    })).sort((a, b) => b.ventas - a.ventas).slice(0, 3);

    const contenedorTopPublico = document.getElementById("lista-top-productos-cliente");
    if(!contenedorTopPublico) return;
    contenedorTopPublico.innerHTML = "";
    
    if(ordenados.length === 0) {
        document.getElementById("seccion-destacados-cliente")?.classList.add("hidden");
        return;
    }
    
    document.getElementById("seccion-destacados-cliente")?.classList.remove("hidden");
    ordenados.forEach((item, index) => {
        const medalla = index === 0 ? "👑" : index === 1 ? "✨" : "💖";
        contenedorTopPublico.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-purple-100 flex items-center gap-3 shadow-2xs">
                <span class="text-lg">${medalla}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-800 truncate">${item.nombre}</p>
                    <p class="text-[9px] font-semibold text-purple-600 uppercase tracking-wider">${item.esKit ? 'Kit Destacado' : 'Favorito del Mes'}</p>
                </div>
            </div>
        `;
    });
}

// ========================================================
// 🌟 OBSERVACIÓN 4: EXPORTACIÓN MENSUAL E IMPRESIÓN DEL BALANCE
// ========================================================
window.exportarHistorialMensual = function() {
    const transaccionesFiltradas = transacciones.filter(t => cumpleFiltroFecha(t.timestamp));
    if (transaccionesFiltradas.length === 0) return alert("No hay transacciones registradas en este periodo para exportar.");

    let printWindow = window.open('', '_blank');
    let tablaHTML = `
        <html>
        <head>
            <title>DAESMI - Reporte Financiero (${filtroFechaActual.toUpperCase()})</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; }
                h1 { color: #5b21b6; margin-bottom: 5px; }
                .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 12px; }
                th { bg-color: #f8fafc; font-weight: bold; }
                .monto { text-align: right; font-weight: bold; }
                .ganancia { color: #059669; }
                .pendiente { color: #d97706; }
                .totales { margin-top: 20px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                .totales p { margin: 5px 0; font-size: 14px; }
            </style>
        </head>
        <body>
            <h1>DAESMI COSMETICS</h1>
            <div class="meta">Reporte de Ventas - Periodo Filtro: <strong>${filtroFechaActual.toUpperCase()}</strong> | Generado el: ${new Date().toLocaleDateString()}</div>
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Artículo / Concepto</th>
                        <th>Estado</th>
                        <th class="monto">Cobrado ($)</th>
                        <th class="monto">Costo Mercancía ($)</th>
                        <th class="monto">Envio Subs ($)</th>
                        <th class="monto">Utilidad Neta ($)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let tVentas = 0, tCostos = 0, tEnvios = 0, tGanancias = 0;

    transaccionesFiltradas.forEach(t => {
        const cost = t.costoReal || 0;
        const env = t.envioAsumido || 0;
        const gan = t.gananciaLimpia !== undefined ? t.gananciaLimpia : (t.totalRecibido - cost);
        
        if (t.estado !== 'pendiente') {
            tVentas += t.totalRecibido;
            tCostos += cost;
            tEnvios += env;
            tGanancias += gan;
        }

        tablaHTML += `
            <tr>
                <td>${t.fecha}</td>
                <td><strong>${t.articulo}</strong></td>
                <td><span class="${t.estado}">${t.estado.toUpperCase()}</span></td>
                <td class="monto">$${t.totalRecibido.toLocaleString()}</td>
                <td class="monto">$${cost.toLocaleString()}</td>
                <td class="monto">$${env.toLocaleString()}</td>
                <td class="monto ganancia">$${t.estado === 'pendiente' ? '0' : gan.toLocaleString()}</td>
            </tr>
        `;
    });

    tablaHTML += `
                </tbody>
            </table>
            <div class="totales">
                <p><strong>Total Facturado Efectivo:</strong> $${tVentas.toLocaleString()} COP</p>
                <p><strong>Costo de Inversión Vendida:</strong> $${tCostos.toLocaleString()} COP</p>
                <p><strong>Total Envíos Asumidos:</strong> $${tEnvios.toLocaleString()} COP</p>
                <p style="font-size:16px; color:#5b21b6;"><strong>Ganancia Limpia Consolidada:</strong> $${tGanancias.toLocaleString()} COP</p>
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `;

    printWindow.document.write(tablaHTML);
    printWindow.document.close();
};

// ========================================================
// 🌟 OBSERVACIONES 1 Y 6: CATEGORÍAS Y RENDERIZADO PRIVADO/PÚBLICO
// ========================================================
function renderizarCategoriasNavegacion() {
    const contenedor = document.getElementById("barras-categorias-filtro");
    if (!contenedor) return;

    const listaCategorias = ["todos", ...new Set(productos.map(p => p.categoria || "General"))];
    contenedor.innerHTML = "";

    listaCategorias.forEach(cat => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${categoriaSeleccionada === cat ? 'bg-purple-800 text-white shadow-xs' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`;
        boton.innerText = cat.charAt(0).toUpperCase() + cat.slice(1);
        boton.onclick = () => {
            categoriaSeleccionada = cat;
            renderizarCategoriasNavegacion();
            renderizarCatalogoTarjetas();
        };
        contenedor.appendChild(boton);
    });
}

function renderizarCatalogoTarjetas() {
    const contenedor = document.getElementById("lista-inventario");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    // Productos Simples (Filtrados por categoría)
    const productosFiltrados = productos.filter(p => categoriaSeleccionada === "todos" || p.categoria === categoriaSeleccionada);

    productosFiltrados.forEach(p => {
        const div = document.createElement("div");
        div.className = "bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex gap-3 relative";
        
        // OBSERVACIÓN 1: El cliente no ve unidades numéricas de stock, solo disponibilidad visual
        const tieneStock = p.stock > 0;
        const textoDisponibilidad = tieneStock ? "✅ Disponible" : "❌ Agotado";
        const claseStock = tieneStock ? "text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md" : "text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md";
        const stockVisual = isAdmin ? `Stock: ${p.stock} u.` : textoDisponibilidad;

        div.innerHTML = `
            ${p.fotoUrl ? `<img src="${p.fotoUrl}" class="w-16 h-16 rounded-xl object-cover bg-slate-50">` : `<div class="w-16 h-16 rounded-xl bg-purple-50 flex items-center justify-center text-purple-400"><i data-lucide="image" class="w-6 h-6"></i></div>`}
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                    <span class="bg-slate-100 text-slate-600 text-[8px] font-black uppercase px-1 rounded">${p.categoria || 'General'}</span>
                    <h4 class="font-bold text-slate-800 text-xs truncate">${p.nombre}</h4>
                </div>
                <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5">${p.descripcion || 'Sin descripción comercial'}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-xs font-black text-purple-900">$${p.precio.toLocaleString()}</span>
                    <span class="text-[10px] font-bold ${isAdmin && p.stock <= 3 ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md' : claseStock}">${stockVisual}</span>
                </div>
                ${tieneStock ? `
                    <button onclick="window.agregarAlCarritoGlobal('${p.id}', 'prod')" class="w-full mt-2 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[10px] py-1.5 rounded-lg font-black transition-colors flex items-center justify-center gap-1 cursor-pointer">
                        <i data-lucide="shopping-cart" class="w-3 h-3"></i> Añadir al pedido
                    </button>
                ` : ''}
            </div>
            <div class="absolute top-3 right-3 flex gap-1 items-center">
                <button onclick="window.abrirPopUpMarketing('${p.id}', 'prod')" class="p-1 text-slate-400 hover:text-purple-700" title="Marketing"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i></button>
                ${isAdmin ? `
                    <button onclick="window.abrirModalProducto('${p.id}')" class="p-1 text-purple-600 hover:text-purple-900" title="Editar"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>
                    <button onclick="window.eliminarElementoEfectivo('${p.id}', 'productos', '${p.nombre}')" class="p-1 text-rose-500 hover:text-rose-700" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                ` : ''}
            </div>
        `;
        contenedor.appendChild(div);
    });

    // Combos y Kits (Aparecen siempre en pestaña 'todos' o si se desea una categoría de kits)
    if(categoriaSeleccionada === "todos") {
        combos.forEach(c => {
            const div = document.createElement("div");
            div.className = "bg-gradient-to-r from-purple-50/50 to-pink-50/30 p-4 rounded-2xl border border-purple-100 shadow-xs flex gap-3 relative";
            
            // Evaluar disponibilidad global del combo basándose en stock real de sus partes
            const comboDisponible = c.productos.every(cp => {
                const real = productos.find(p => p.id === cp.id);
                return real && real.stock >= cp.cantidad;
            });

            div.innerHTML = `
                ${c.fotoUrl ? `<img src="${c.fotoUrl}" class="w-16 h-16 rounded-xl object-cover bg-white">` : `<div class="w-16 h-16 rounded-xl bg-purple-100 flex items-center justify-center text-purple-500"><i data-lucide="package" class="w-6 h-6"></i></div>`}
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1"><span class="bg-purple-600 text-white text-[8px] font-black uppercase px-1 rounded">Kit</span><h4 class="font-bold text-slate-800 text-xs truncate">${c.nombre}</h4></div>
                    <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5">${c.descripcion || 'Kit de temporada seleccionado'}</p>
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-xs font-black text-purple-900">$${c.precioVenta.toLocaleString()}</span>
                        <span class="text-[9px] font-bold ${comboDisponible ? 'text-purple-600 bg-purple-100/50' : 'text-rose-600 bg-rose-50'} px-1.5 py-0.5 rounded-md">${comboDisponible ? 'Combo Listo' : 'Agotado'}</span>
                    </div>
                    ${comboDisponible ? `
                        <button onclick="window.agregarAlCarritoGlobal('${c.id}', 'combo')" class="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white text-[10px] py-1.5 rounded-lg font-black transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs">
                            <i data-lucide="shopping-cart" class="w-3 h-3"></i> Añadir Kit al Pedido
                        </button>
                    ` : ''}
                </div>
                <div class="absolute top-3 right-3 flex gap-1 items-center">
                    <button onclick="window.abrirPopUpMarketing('${c.id}', 'combo')" class="p-1 text-slate-400 hover:text-purple-700" title="Marketing"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i></button>
                    ${isAdmin ? `
                        <button onclick="window.abrirModalCombo('${c.id}')" class="p-1 text-purple-600 hover:text-purple-900" title="Editar Kit"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.eliminarElementoEfectivo('${c.id}', 'combos', '${c.nombre}')" class="p-1 text-rose-500 hover:text-rose-700" title="Eliminar Kit"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    ` : ''}
                </div>
            `;
            contenedor.appendChild(div);
        });
    }

    lucide.createIcons();
}

// ========================================================
// 🌟 OBSERVACIÓN 5: LÓGICA COMPLETA DEL CARRITO DE COMPRAS -> WHATSAPP
// ========================================================
function inicializarManejadoresCarrito() {
    window.agregarAlCarritoGlobal = function(id, tipo) {
        let itemEncontrado = null;
        if (tipo === 'prod') {
            const p = productos.find(x => x.id === id);
            if(p) itemEncontrado = { id, tipo, nombre: p.nombre, precio: p.precio };
        } else {
            const c = combos.find(x => x.id === id);
            if(c) itemEncontrado = { id, tipo, nombre: `[Kit] ${c.nombre}`, precio: c.precioVenta };
        }

        if(!itemEncontrado) return;

        const existente = carrito.find(x => x.id === id && x.tipo === tipo);
        if(existente) {
            existente.cantidad += 1;
        } else {
            itemEncontrado.cantidad = 1;
            carrito.push(itemEncontrado);
        }

        localStorage.setItem("daesmi_carrito", JSON.stringify(carrito));
        actualizarBadgeCarritoVisual();
        renderizarItemsCarritoModal();
    };

    window.cambiarCantidadCarrito = function(index, delta) {
        carrito[index].cantidad += delta;
        if(carrito[index].cantidad <= 0) {
            carrito.splice(index, 1);
        }
        localStorage.setItem("daesmi_carrito", JSON.stringify(carrito));
        actualizarBadgeCarritoVisual();
        renderizarItemsCarritoModal();
    };

    window.abrirModalCarritoCompleto = function() {
        renderizarItemsCarritoModal();
        document.getElementById("modal-carrito-cliente").classList.replace("hidden", "flex");
    };

    window.cerrarModalCarritoCompleto = function() {
        document.getElementById("modal-carrito-cliente").classList.replace("flex", "hidden");
    };

    window.enviarPedidoWhatsApp = function() {
        if(carrito.length === 0) return alert("Tu carrito está vacío.");
        
        let mensaje = `✨ *NUEVO PEDIDO - DAESMI COSMETICS* ✨\n\nHola, me interesa adquirir los siguientes artículos:\n\n`;
        let total = 0;

        carrito.forEach(item => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;
            mensaje += `🛍️ *${item.cantidad}x* ${item.nombre} \n   └ Subtotal: $${subtotal.toLocaleString()} COP\n\n`;
        });

        mensaje += `💵 *TOTAL ESTIMADO:* $${total.toLocaleString()} COP\n\nPor favor, confírmame la disponibilidad para coordinar el envío. 💖📦`;
        
        const urlFinal = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
        
        // Limpiamos carrito tras confirmación de envío
        carrito = [];
        localStorage.removeItem("daesmi_carrito");
        actualizarBadgeCarritoVisual();
        window.cerrarModalCarritoCompleto();
        
        window.open(urlFinal, '_blank');
    };
}

function actualizarBadgeCarritoVisual() {
    const totalUnidades = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const badge = document.getElementById("carrito-badge-conteo");
    const barraFlotante = document.getElementById("barra-flotante-carrito");
    
    if(badge) badge.innerText = totalUnidades;
    
    if(barraFlotante) {
        if(totalUnidades > 0) {
            barraFlotante.classList.remove("hidden");
            barraFlotante.classList.add("flex");
        } else {
            barraFlotante.classList.remove("flex");
            barraFlotante.classList.add("hidden");
        }
    }
}

function renderizarItemsCarritoModal() {
    const contenedor = document.getElementById("carrito-lista-items");
    const txtTotal = document.getElementById("carrito-total-monto");
    if(!contenedor) return;

    contenedor.innerHTML = "";
    let acumuladoTotal = 0;

    if(carrito.length === 0) {
        contenedor.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">No has agregado cosméticos aún.</p>`;
        if(txtTotal) txtTotal.innerText = "$0";
        return;
    }

    carrito.forEach((item, index) => {
        acumuladoTotal += (item.precio * item.cantidad);
        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs";
        div.innerHTML = `
            <div class="flex-1 min-w-0 pr-2">
                <p class="font-bold text-slate-800 truncate">${item.nombre}</p>
                <p class="text-[10px] font-black text-purple-900">$${item.precio.toLocaleString()}</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="window.cambiarCantidadCarrito(${index}, -1)" class="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-center flex items-center justify-center cursor-pointer">-</button>
                <span class="font-bold text-slate-800 text-xs w-4 text-center">${item.cantidad}</span>
                <button onclick="window.agregarAlCarritoGlobal('${item.id}', '${item.tipo}')" class="w-6 h-6 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg font-bold text-center flex items-center justify-center cursor-pointer">+</button>
            </div>
        `;
        contenedor.appendChild(div);
    });

    if(txtTotal) txtTotal.innerText = `$${acumuladoTotal.toLocaleString()}`;
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
    document.getElementById("mkt-texto-copy").value = `✨ ¡Miren este espectacular artículo disponible en DAESMI! ✨\n\n🛍️ *${titulo}*\n📝 ${desc}\n\n💵 *Precio imperdible:* $${precio.toLocaleString()} COP\n\nEscríbenos directamente para agendar tu pedido antes de que se agote. 💖📦`;

    const modalMkt = document.getElementById("modal-marketing");
    modalMkt.classList.remove("hidden");
    modalMkt.classList.add("flex");
    lucide.createIcons();
};

function verificarAlertasStock() {
    const contenedorAlertas = document.getElementById("contenedor-alertas-stock");
    if (!contenedorAlertas) return;
    contenedorAlertas.innerHTML = "";

    if (!isAdmin) {
        contenedorAlertas.classList.add("hidden");
        return; 
    }

    const criticos = productos.filter(p => p.stock <= 3 && !alertasOcultasTemporalmente.includes(p.id));

    if (criticos.length === 0) {
        if (productos.some(p => p.stock <= 3)) {
            contenedorAlertas.classList.add("hidden");
        } else {
            contenedorAlertas.classList.remove("hidden");
            contenedorAlertas.innerHTML = `
                <div class="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-[11px] font-medium flex items-center gap-2 w-full">
                    <span>✅ ¡Excelente! Todo tu inventario cuenta con buen stock.</span>
                </div>
            `;
        }
        return;
    }

    contenedorAlertas.classList.remove("hidden");
    criticos.forEach(p => {
        contenedorAlertas.innerHTML += `
            <div id="alerta-stock-${p.id}" class="p-2.5 rounded-xl text-[11px] flex justify-between items-center w-full mb-2 ${p.stock === 0 ? 'bg-rose-50 text-rose-900 border-l-4 border-rose-500' : 'bg-amber-50 text-amber-900 border-l-4 border-amber-500'}">
                <div class="flex items-center gap-1.5 flex-1">
                    <span>⚠️ <strong>${p.nombre}</strong> - Quedan solo ${p.stock} unidades.</span>
                    <button onclick="window.abrirModalProducto('${p.id}')" class="underline font-bold hover:text-purple-800 ml-1">Surtir</button>
                </div>
                <button onclick="window.descartarAlertaTemporal('${p.id}')" class="text-slate-400 hover:text-slate-700 font-black text-xs px-1 ml-2" title="Cerrar aviso temporalmente">✕</button>
            </div>
        `;
    });
}

window.descartarAlertaTemporal = function(idProducto) {
    alertasOcultasTemporalmente.push(idProducto);
    verificarAlertasStock();
};

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

// ========================================================
// 🌟 OBSERVACIÓN 2: CAPITAL INVERSIÓN Y PRECIO DE VENTA BASE EN COMBOS
// ========================================================
function actualizarListaVisualCombo() {
    const lista = document.getElementById("combo-lista-productos-temporal");
    if(!lista) return;
    lista.innerHTML = "";
    
    let costoAcumulado = 0;
    let precioVentaBaseAcumulado = 0;

    productosEnComboTemporal.forEach((p, index) => {
        costoAcumulado += (p.costo * p.cantidad);
        precioVentaBaseAcumulado += (p.precioIndividual * p.cantidad);
        
        lista.innerHTML += `
            <li class="flex justify-between items-center text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span>${p.nombre} (x${p.cantidad})</span>
                <button type="button" class="text-rose-500 hover:text-rose-700 font-bold" onclick="window.quitarItemComboTemporal(${index})">Eliminar</button>
            </li>
        `;
    });

    const infoCosto = document.getElementById("combo-costo-calculado");
    if(infoCosto) infoCosto.innerText = `$${costoAcumulado.toLocaleString()}`;

    // Despliegue visual del precio de venta combinado acumulado para toma de decisiones óptimas
    const infoPrecioSugerido = document.getElementById("combo-precio-base-sugerido");
    if(infoPrecioSugerido) infoPrecioSugerido.innerText = `$${precioVentaBaseAcumulado.toLocaleString()}`;
}

window.quitarItemComboTemporal = function(index) {
    productosEnComboTemporal.splice(index, 1);
    actualizarListaVisualCombo();
}

window.eliminarElementoEfectivo = async function(id, coleccion, nombre) {
    const confirmar = confirm(`¿Estás completamente segura de que deseas eliminar "${nombre}" de DAESMI? Esta acción no se puede deshacer.`);
    if (confirmar) {
        try {
            await deleteDoc(doc(db, coleccion, id));
            alert(`"${nombre}" ha sido eliminado correctamente.`);
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("Hubo un error de permisos en Firebase al intentar eliminar el elemento.");
        }
    }
};

window.eliminarVentaInteligente = async function(idTransaccion, nombreArticulo) {
    const confirmarBorrado = confirm(`¿Estás segura de eliminar la venta de "${nombreArticulo}"?\nEsta acción la quitará de los reportes y balances.`);
    if (!confirmarBorrado) return;

    const trans = transacciones.find(t => t.id === idTransaccion);
    if (!trans) return alert("No se encontró la información de la transacción.");

    const devolverStock = confirm(`🔄 ¿Deseas regresar este producto al INVENTARIO?\n\n[Aceptar] = Sí, la mercancía vuelve a estar disponible para la venta.\n[Cancelar] = No, la mercancía se perdió o fue un ajuste manual.`);

    try {
        if (devolverStock) {
            if (nombreArticulo.startsWith("[Kit]")) {
                const comboNombreLimpio = nombreArticulo.replace("[Kit] ", "");
                const comboOriginal = combos.find(c => c.nombre === comboNombreLimpio);
                
                if (comboOriginal && comboOriginal.productos) {
                    for (let item of comboOriginal.productos) {
                        const prodInventario = productos.find(p => p.id === item.id);
                        if (prodInventario) {
                            await updateDoc(doc(db, "productos", item.id), {
                                stock: prodInventario.stock + item.cantidad
                            });
                        }
                    }
                }
            } else {
                const prodInventario = productos.find(p => p.nombre === nombreArticulo);
                if (prodInventario) {
                    await updateDoc(doc(db, "productos", prodInventario.id), {
                        stock: prodInventario.stock + 1
                    });
                } else {
                    alert("⚠️ La venta se borrará, pero el producto original no se encontró en el inventario actual para sumarle el stock.");
                }
            }
        }

        await deleteDoc(doc(db, "transacciones", idTransaccion));
        alert("Transacción eliminada correctamente. Tus balances se han actualizado.");

    } catch (error) {
        console.error("Error al eliminar la transacción:", error);
        alert("Hubo un error de permisos or conexión al intentar borrar la venta.");
    }
};

// ========================================================
// 8. MÓDULO: DETALLE DE RECIBO DE VENTA (MODAL FLOTANTE JS)
// ========================================================
window.abrirDetalleReciboVenta = function(idTransaccion) {
    const t = transacciones.find(trans => trans.id === idTransaccion);
    if (!t) return;

    let modalRecibo = document.getElementById("modal-recibo-dinamico");
    if (!modalRecibo) {
        modalRecibo = document.createElement("div");
        modalRecibo.id = "modal-recibo-dinamico";
        modalRecibo.className = "fixed inset-0 bg-slate-900/60 backdrop-blur-xs hidden justify-center items-center z-50 p-4";
        document.body.appendChild(modalRecibo);
    }

    const costoBase = t.costoReal || 0;
    const envioAsumido = t.envioAsumido || 0;
    const gananciaReal = t.gananciaLimpia !== undefined ? t.gananciaLimpia : (t.totalRecibido - costoBase);

    modalRecibo.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div class="text-center border-b border-dashed border-slate-200 pb-3">
                <h4 class="font-black text-purple-900 text-sm tracking-tight">DAESMI COSMETICS</h4>
                <p class="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Comprobante de Operación</p>
            </div>
            
            <div class="space-y-2 text-xs">
                <div class="flex justify-between gap-4"><span class="text-slate-400 font-medium">Artículo:</span><span class="font-bold text-slate-800 text-right max-w-[200px] truncate">${t.articulo}</span></div>
                <div class="flex justify-between"><span class="text-slate-400 font-medium">Fecha y Hora:</span><span class="text-slate-700 font-medium">${t.fecha}</span></div>
                <div class="flex justify-between"><span class="text-slate-400 font-medium">Estado Pago:</span><span class="px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded-sm font-bold uppercase text-[9px]">${t.estado}</span></div>
                
                <hr class="border-slate-100 my-2">
                
                <div class="flex justify-between text-slate-700"><span>Cobrado al Cliente:</span><span class="font-bold text-emerald-600">+$${t.totalRecibido.toLocaleString()}</span></div>
                <div class="flex justify-between text-slate-400"><span>Costo de Mercancía:</span><span class="font-medium">-$${costoBase.toLocaleString()}</span></div>
                <div class="flex justify-between text-slate-400"><span>Envío Subsidiado:</span><span class="font-medium ${envioAsumido > 0 ? 'text-rose-500 font-bold' : ''}">-$${envioAsumido.toLocaleString()}</span></div>
                
                <div class="bg-purple-50/70 p-2.5 rounded-xl flex justify-between items-center mt-3 border border-purple-100/50">
                    <span class="font-bold text-purple-950 text-[11px] uppercase tracking-wider">Utilidad Real:</span>
                    <span class="font-black text-purple-900 text-sm">$${gananciaReal.toLocaleString()}</span>
                </div>
            </div>

            <button onclick="document.getElementById('modal-recibo-dinamico').classList.replace('flex', 'hidden')" class="w-full bg-slate-900 text-white p-2.5 rounded-xl font-bold text-xs mt-2 transition-colors cursor-pointer hover:bg-slate-800">
                Cerrar Comprobante
            </button>
        </div>
    `;

    modalRecibo.classList.replace("hidden", "flex");
};

// ========================================================
// 🪙 MÓDULO ADMINISTRATIVO DE LA CAJA FUERTE
// ========================================================
window.ajustarCapitalBaseManual = async function() {
    if (!isAdmin) return alert("Acceso denegado.");
    const nuevoCapital = prompt("Ingresa el nuevo Capital Base (Colchón de dinero en efectivo):", capitalBaseFijo);
    if (nuevoCapital === null) return;
    
    const valorNumerico = parseFloat(nuevoCapital) || 0;
    try {
        await updateDoc(doc(db, "configuracion", "caja_daesmi"), { capitalBase: valorNumerico });
        alert(`Capital Base actualizado a: $${valorNumerico.toLocaleString()} COP`);
    } catch (e) {
        alert("Error de permisos al actualizar base.");
    }
};

window.actualizarCapitalBaseDesdeAjustes = async function() {
    if (!isAdmin) return alert("Acceso denegado.");
    const input = document.getElementById("input-ajuste-capital");
    if (!input || !input.value.trim()) return alert("Por favor ingresa un monto válido.");

    const valor = parseFloat(input.value) || 0;
    try {
        await updateDoc(doc(db, "configuracion", "caja_daesmi"), { capitalBase: valor });
        alert(`¡Éxito! El Capital Base operativo se fijó en $${valor.toLocaleString()} COP.`);
        input.value = "";
    } catch (e) {
        alert("No tienes permisos suficientes para alterar los registros.");
    }
};

window.abrirModalRetiro = function() {
    if (!isAdmin) return alert("Solo el administrador puede retirar dinero de las utilidades.");
    document.getElementById("retiro-monto").value = "";
    document.getElementById("modal-retiro-ganancias").classList.replace("hidden", "flex");
};

window.cerrarModalRetiro = function() {
    document.getElementById("modal-retiro-ganancias").classList.replace("flex", "hidden");
};

window.ejecutarRetiroGanancias = async function() {
    if (!isAdmin) return;
    const montoInput = document.getElementById("retiro-monto");
    const montoARetirar = parseFloat(montoInput.value) || 0;

    if (montoARetirar <= 0) return alert("Ingresa un monto válido mayor a cero.");

    const nuevoTotalRetiros = retirosAcumulados + montoARetirar;

    try {
        await updateDoc(doc(db, "configuracion", "caja_daesmi"), { retiros: nuevoTotalRetiros });
        alert(`Retiro exitoso de $${montoARetirar.toLocaleString()} COP registrado.\nTu Efectivo Total en Caja se ha recalculado.`);
        window.cerrarModalRetiro();
    } catch (error) {
        console.error(error);
        alert("Error al intentar asentar el retiro en la base de datos.");
    }
};
