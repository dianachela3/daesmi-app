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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Estado Global
let productos = [];
let combos = [];
let transacciones = [];
let idElementoEdicion = null;
let productosEnComboTemporal = [];
let filtroFechaActual = "mes"; 
let isAdmin = false;
let capitalBaseFijo = 0;
let retirosAcumulados = 0;

// Inicialización de la Aplicación al Cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    inicializarNavegacionYModales();
    inicializarAutenticacion();
    escucharDatosFirebase();
    configurarSelectoresFiltro();
    vincularEventosDomAdicionales();
});

// ========================================================
// 1. CONTROL DE AUTENTICACIÓN
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
            if (txtEstadoSesion) txtEstadoSesion.innerText = "Panel Admin";
            document.getElementById("nav-balance")?.classList.remove("hidden");
            document.getElementById("nav-ajustes")?.classList.remove("hidden");
            document.getElementById("wrapper-acciones-inventario")?.classList.remove("hidden");
            
            if (!document.getElementById("view-login")?.classList.contains("hidden")) {
                window.cambiarVistaEfectiva("view-balance", document.getElementById("nav-balance"));
            }
        } else {
            isAdmin = false;
            if (txtEstadoSesion) txtEstadoSesion.innerText = "Login";
            document.getElementById("nav-balance")?.classList.add("hidden");
            document.getElementById("nav-ajustes")?.classList.add("hidden");
            document.getElementById("wrapper-acciones-inventario")?.classList.add("hidden");
            window.cambiarVistaEfectiva("view-inventario", document.getElementById("nav-inventario"));
        }
        renderizarCatalogoTarjetas();
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
        renderizarCatalogoTarjetas();
    });

    onSnapshot(query(collection(db, "combos"), orderBy("nombre")), (snapshot) => {
        combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
// 3. NAVEGACIÓN Y EVENTOS CENTRALIZADOS
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
                b.className = "flex flex-col items-center gap-1 btn-nav-inactive transition-colors cursor-pointer";
            }
        });
        if(bActivo) { 
            bActivo.className = "flex flex-col items-center gap-1 btn-nav-active transition-colors cursor-pointer";
        }
    };

    if(btnBalance) btnBalance.addEventListener("click", () => cambiarVistaEfectiva("view-balance", btnBalance));
    if(btnInventario) btnInventario.addEventListener("click", () => cambiarVistaEfectiva("view-inventario", btnInventario));
    if(btnAjustes) btnAjustes.addEventListener("click", () => cambiarVistaEfectiva("view-ajustes", btnAjustes));
}

// Vinculación de eventos que antes estaban inline en el HTML
function vincularEventosDomAdicionales() {
    // Modales de Retiro
    document.getElementById("btn-trigger-modal-retiro")?.addEventListener("click", () => window.abrirModalRetiro());
    document.getElementById("btn-cerrar-modal-retiro")?.addEventListener("click", () => window.cerrarModalRetiro());
    document.getElementById("btn-cancelar-retiro")?.addEventListener("click", () => window.cerrarModalRetiro());
    document.getElementById("btn-confirmar-retiro")?.addEventListener("click", () => window.ejecutarRetiroGanancias());
    document.getElementById("btn-trigger-capital-manual")?.addEventListener("click", () => window.ajustarCapitalBaseManual());
    document.getElementById("btn-guardar-capital-ajustes")?.addEventListener("click", () => window.actualizarCapitalBaseDesdeAjustes());
}

// ========================================================
// 4. CONTROL DE VENTANAS EMERGENTES (MODALES GLOBALIZADOS)
// ========================================================
window.abrirModalRetiro = function() {
    if (!isAdmin) return alert("Solo el administrador puede retirar dinero de las utilidades.");
    const inputMonto = document.getElementById("retiro-monto");
    if (inputMonto) inputMonto.value = "";
    document.getElementById("modal-retiro-ganancias")?.classList.replace("hidden", "flex");
};

window.cerrarModalRetiro = function() {
    document.getElementById("modal-retiro-ganancias")?.classList.replace("flex", "hidden");
};

window.ejecutarRetiroGanancias = async function() {
    if (!isAdmin) return;
    const montoInput = document.getElementById("retiro-monto");
    const montoARetirar = parseFloat(montoInput.value) || 0;

    if (montoARetirar <= 0) return alert("Ingresa un monto válido mayor a cero.");
    const nuevoTotalRetiros = retirosAcumulados + montoARetirar;

    try {
        await updateDoc(doc(db, "configuracion", "caja_daesmi"), { retiros: nuevoTotalRetiros });
        alert(`Retiro exitoso de $${montoARetirar.toLocaleString()} COP registrado.`);
        window.cerrarModalRetiro();
    } catch (error) {
        console.error("Error al retirar:", error);
    }
};

window.ajustarCapitalBaseManual = async function() {
    if (!isAdmin) return;
    const nuevoValor = prompt("Ingresa el nuevo Capital Base Inicial de la caja fuerte:", capitalBaseFijo);
    if (nuevoValor === null) return;
    const cleanNum = parseFloat(nuevoValor) || 0;
    try {
        await updateDoc(doc(db, "configuracion", "caja_daesmi"), { capitalBase: cleanNum });
        alert("Capital base inicial actualizado correctamente.");
    } catch (e) {
        console.error(e);
    }
};

window.actualizarCapitalBaseDesdeAjustes = async function() {
    if (!isAdmin) return;
    const input = document.getElementById("input-ajuste-capital");
    const valor = parseFloat(input.value) || 0;
    if (valor < 0) return alert("El capital no puede ser menor a 0.");
    try {
        await updateDoc(doc(db, "configuracion", "caja_daesmi"), { capitalBase: valor });
        alert("Capital Base actualizado desde Ajustes.");
        input.value = "";
    } catch (e) {
        console.error(e);
    }
};

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
            if(b) b.className = "flex-1 text-center py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer";
        });
        if(btnActivo) {
            btnActivo.className = "flex-1 text-center py-2 bg-purple-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer";
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
            div.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-slate-800 truncate">${t.articulo}</p>
                    <p class="text-[10px] text-slate-400">${t.fecha}</p>
                </div>
                <div class="text-right flex items-center gap-2">
                    <div>
                        <p class="font-black ${t.estado === 'pendiente' ? 'text-amber-600' : 'text-emerald-600'}">$${t.totalRecibido.toLocaleString()}</p>
                        <span class="text-[9px] uppercase font-bold tracking-wider ${t.estado === 'pendiente' ? 'text-amber-700 bg-amber-50' : 'text-emerald-700 bg-emerald-50'} px-1.5 py-0.5 rounded-md">${t.estado}</span>
                    </div>
                </div> `;
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
    
    calcularTopProductos(transaccionesFiltradas);
}

function calcularTopProductos(listaTransacciones) {
    const conteo = {};
    listaTransacciones.forEach(t => { conteo[t.articulo] = (conteo[t.articulo] || 0) + 1; });
    const ordenados = Object.keys(conteo).map(name => ({ nombre: name, ventas: conteo[name] })).sort((a, b) => b.ventas - a.ventas).slice(0, 3);
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
            </div> `;
    });
}

// ========================================================
// 6. RENDERIZADO DEL CATÁLOGO
// ========================================================
function renderizarCatalogoTarjetas() {
    const contenedor = document.getElementById("lista-inventario");
    if (!contenedor) return;
    contenedor.innerHTML = "";

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
            </div> `;
        contenedor.appendChild(div);
    });
    
    // Inicializar iconos de Lucide dinámicos
    if (window.lucide) {
        window.lucide.createIcons();
    }
}
