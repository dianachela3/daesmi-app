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
            
            // 🔥 CAMBIO AQUÍ: Activamos las escuchas privadas de transacciones y caja ya que hay sesión
            activarEscuchasFinancierasPrivadas();

            if (!document.getElementById("view-login")?.classList.contains("hidden")) {
                window.cambiarVistaEfectiva("view-balance", document.getElementById("nav-balance"));
            }
        } else {
            isAdmin = false;
            if (txtEstadoSesion) txtEstadoSesion.innerText = "Login";
            document.getElementById("nav-balance")?.classList.add("hidden");
            document.getElementById("nav-ajustes")?.classList.add("hidden");
            document.getElementById("wrapper-acciones-inventario")?.classList.add("hidden");
            
            // 🔥 CAMBIO AQUÍ: Apagamos las escuchas privadas para que no generen errores de permisos
            desactivarEscuchasFinancierasPrivadas();

            // Limpiamos los arreglos en memoria de la interfaz de administración
            transacciones = [];
            
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

// Variables globales para controlar la cancelación de las escuchas privadas
let desesqucharTransacciones = null;
let desescucharConfiguracion = null;

// ========================================================
// 2. ESCUCHA DE DATOS EN TIEMPO REAL (FIREBASE)
// ========================================================
function escucharDatosFirebase() {
    // ESCUCHAS PÚBLICAS: Funcionan siempre, con o sin sesión activa
    onSnapshot(query(collection(db, "productos"), orderBy("nombre")), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarCatalogoTarjetas();
    });

    onSnapshot(query(collection(db, "combos"), orderBy("nombre")), (snapshot) => {
        combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarCatalogoTarjetas();
    });
}

// NUEVA FUNCIÓN PRIVADA: Solo se invoca cuando el administrador se autentica con éxito
function activarEscuchasFinancierasPrivadas() {
    // Si ya existía una escucha activa previa, la apagamos para no duplicar procesos
    desactivarEscuchasFinancierasPrivadas();

    console.log("🔒 Activando canales de tiempo real seguros para administración...");

    desesqucharTransacciones = onSnapshot(
        query(collection(db, "transacciones"), orderBy("timestamp", "desc")), 
        (snapshot) => {
            transacciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            procesarYRenderizarBalance();
        },
        (error) => {
            console.error("Error en transacciones:", error);
        }
    );

    desescucharConfiguracion = onSnapshot(
        doc(db, "configuracion", "caja_daesmi"), 
        (docSnap) => {
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
        },
        (error) => {
            console.error("Error en configuración de caja:", error);
        }
    );
}

// NUEVA FUNCIÓN DE LIMPIEZA: Apaga los flujos de datos privados al cerrar sesión
function desactivarEscuchasFinancierasPrivadas() {
    if (typeof desesqucharTransacciones === "function") {
        desesqucharTransacciones();
        desesqucharTransacciones = null;
    }
    if (typeof desescucharConfiguracion === "function") {
        desescucharConfiguracion();
        desescucharConfiguracion = null;
    }
    console.log("🔓 Canales financieros privados desvinculados.");
}
// ========================================================
// 3. NAVEGACIÓN Y EVENTOS CENTRALIZADOS
// ========================================================
// ========================================================
// 3. NAVEGACIÓN Y EVENTOS CENTRALIZADOS
// ========================================================
function inicializarNavegacionYModales() {
    const btnBalance = document.getElementById("nav-balance");
    const btnInventario = document.getElementById("nav-inventario");
    const btnAjustes = document.getElementById("nav-ajustes");
    const botones = [btnBalance, btnInventario, btnAjustes];

    window.cambiarVistaEfectiva = function(vistaActivaId, bActivo) {
        // Ocultar todas las secciones de contenido
        document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
        
        // Mostrar solo la sección seleccionada
        const targetSection = document.getElementById(vistaActivaId);
        if (targetSection) targetSection.classList.remove("hidden");
        
        // Manejar los estilos visuales de los botones de navegación SIN alterar su visibilidad (hidden)
        botones.forEach(b => { 
            if (b) {
                // Removemos las clases de estado activo/inactivo previas
                b.classList.remove("btn-nav-active", "text-purple-800", "font-bold");
                b.classList.add("btn-nav-inactive", "text-slate-400", "font-medium");
            }
        });
        
        if (bActivo) { 
            bActivo.classList.remove("btn-nav-inactive", "text-slate-400", "font-medium");
            bActivo.classList.add("btn-nav-active", "text-purple-800", "font-bold");
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
    const filtroMesSelect = document.getElementById("filtro-mes-select");

    if (filtroMesSelect) {
        // Escuchamos cuando cambies de opción en el menú desplegable
        filtroMesSelect.addEventListener("change", () => {
            // Guardamos la selección global si la necesitas en otra parte (ej: "actual", "anterior", "todos")
            filtroFechaActual = filtroMesSelect.value;
            
            // Volvemos a calcular todo el balance de inmediato
            procesarYRenderizarBalance();
        });
        
        // Inicializamos la variable con el valor por defecto que tenga el select ("actual")
        filtroFechaActual = filtroMesSelect.value;
    }
}

function cumpleFiltroFecha(timestamp) {
    // Si la transacción no tiene fecha o seleccionaste ver todo el historial
    if (filtroFechaActual === "todos") return true;
    if (!timestamp) return false;

    // Convertir el timestamp de Firebase a un objeto Date nativo de JavaScript
    const fechaTransaccion = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    const ahora = new Date();
    const añoActual = ahora.getFullYear();
    const mesActual = ahora.getMonth(); // 0 = Enero, 11 = Diciembre

    const añoT = fechaTransaccion.getFullYear();
    const mesT = fechaTransaccion.getMonth();

    // Filtro para el Mes Actual
    if (filtroFechaActual === "actual") {
        return añoT === añoActual && mesT === mesActual;
    }

    // Filtro para el Mes Anterior
    if (filtroFechaActual === "anterior") {
        // Validamos el caso especial: si estamos en Enero (0), el mes anterior es Diciembre (11) del año pasado
        const añoObjetivo = mesActual === 0 ? añoActual - 1 : añoActual;
        const mesObjetivo = mesActual === 0 ? 11 : mesActual - 1;
        
        return añoT === añoObjetivo && mesT === mesObjetivo;
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

function calcularTopProductos(transaccionesParaTop) {
    const contenedorTop = document.getElementById("lista-top-productos");
    if (!contenedorTop) return;
    
    contenedorTop.innerHTML = "";

    // 1. Contar cuántas unidades se han vendido de cada artículo
    const conteo = {};
    transaccionesParaTop.forEach(t => {
        // Solo contamos transacciones de ventas reales y que estén pagadas o entregadas
        if (t.articulo && t.estado !== "pendiente") { 
            conteo[t.articulo] = (conteo[t.articulo] || 0) + 1;
        }
    });

    // 2. Convertir a un arreglo y ordenarlo de mayor a menor
    const topOrdenado = Object.keys(conteo).map(nombre => {
        return { nombre: nombre, cantidad: conteo[nombre] };
    }).sort((a, b) => b.cantidad - a.cantidad);

    // 🔥 CAMBIO CLAVE: Tomar únicamente los 3 primeros productos
    const top3 = topOrdenado.slice(0, 3);

    // 3. Si no hay ventas registradas aún, mostrar un mensaje bonito de invitación
    if (top3.length === 0) {
        contenedorTop.innerHTML = `<p class="text-[11px] text-slate-400 text-center py-1">¡Explora nuestro catálogo y llévate tus favoritos!</p>`;
        return;
    }

    // 4. Renderizar el Top 3 con un diseño elegante para los clientes
    top3.forEach((prod, indice) => {
        // Medallas para el 1°, 2° y 3° lugar
        const medallas = ["🥇", "🥈", "🥉"];
        const medalla = medallas[indice] || "✨";

        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs";
        div.innerHTML = `
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm flex-shrink-0">${medalla}</span>
                <p class="font-bold text-slate-700 truncate">${prod.nombre}</p>
            </div>
            <span class="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full flex-shrink-0">
                ${prod.cantidad} unds
            </span>
        `;
        contenedorTop.appendChild(div);
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

// ========================================================
// CONTROL DE VENTANAS EMERGENTES (MODALES ADICIONALES)
// ========================================================

// 1. Control para Registro de Ventas
window.abrirModalVenta = function() {
    if (!isAdmin) return alert("Acceso denegado: Inicia sesión como administrador.");
    
    // Si tienes campos de formulario con estos IDs, los limpia al abrir
    const artInput = document.getElementById("venta-articulo");
    const recInput = document.getElementById("venta-recibido");
    const cosInput = document.getElementById("venta-costo");
    
    if(artInput) artInput.value = "";
    if(recInput) recInput.value = "";
    if(cosInput) cosInput.value = "";
    
    const modal = document.getElementById("modal-registro-venta");
    if(modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    } else {
        // Alerta de respaldo si el modal aún no se ha creado en el HTML
        alert("Formulario de venta en desarrollo o ID 'modal-registro-venta' no encontrado.");
    }
};

window.cerrarModalVenta = function() {
    const modal = document.getElementById("modal-registro-venta");
    if(modal) {
        modal.classList.remove("flex");
        modal.classList.add("hidden");
    }
};

// 2. Control para Armado de Combos / Kits
window.abrirModalCombo = function() {
    if (!isAdmin) return alert("Acceso denegado: Inicia sesión como administrador.");
    
    // Si tienes campos de formulario con estos IDs, los limpia al abrir
    const nomInput = document.getElementById("combo-nombre");
    const pcoInput = document.getElementById("combo-precio");
    const ccoInput = document.getElementById("combo-costo");
    
    if(nomInput) nomInput.value = "";
    if(pcoInput) pcoInput.value = "";
    if(ccoInput) ccoInput.value = "";
    
    const modal = document.getElementById("modal-registro-combo");
    if(modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    } else {
        // Alerta de respaldo si el modal aún no se ha creado en el HTML
        alert("Formulario de combos en desarrollo o ID 'modal-registro-combo' no encontrado.");
    }
};

window.cerrarModalCombo = function() {
    const modal = document.getElementById("modal-registro-combo");
    if(modal) {
        modal.classList.remove("flex");
        modal.classList.add("hidden");
    }
};
