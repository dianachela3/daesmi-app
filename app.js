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
let listaProductosGlobal = [];
let listaCombosGlobal = [];
let listaTransaccionesGlobal = [];
let carritoGlobal = []; // Estructura híbrida para la bolsa del cliente
let itemsComboTemporal = []; // Para la creación de kits/combos
let idProductoEditando = null;
let idComboEditando = null;

// Control de Caja Fuerte / Auditoría
let capitalBaseFijo = 0;
let retirosAcumulados = 0;

// Estado de Autenticación (Admin)
let isAdmin = false;

// Elementos de la Interfaz de Usuario (DOM)
const viewBalance = document.getElementById("view-balance");
const viewInventario = document.getElementById("view-inventario");
const viewAjustes = document.getElementById("view-ajustes");
const viewLogin = document.getElementById("view-login");

const navBalance = document.getElementById("nav-balance");
const navInventario = document.getElementById("nav-inventario");
const navAjustes = document.getElementById("nav-ajustes");

const btnEstadoSesion = document.getElementById("btn-estado-sesion");
const txtEstadoSesion = document.getElementById("txt-estado-sesion");

// ==========================================
// 1. SISTEMA DE ENRUTAMIENTO Y VISTAS
// ==========================================
function ocultarTodasLasVistas() {
    viewBalance.classList.add("hidden");
    viewInventario.classList.add("hidden");
    viewAjustes.classList.add("hidden");
    viewLogin.classList.add("hidden");

    navBalance.classList.replace("text-purple-800", "text-slate-400");
    navInventario.classList.replace("text-purple-800", "text-slate-400");
    navAjustes.classList.replace("text-purple-800", "text-slate-400");
    
    navBalance.classList.remove("font-bold");
    navInventario.classList.remove("font-bold");
    navAjustes.classList.remove("font-bold");
}

function mostrarVista(vista, navElement) {
    ocultarTodasLasVistas();
    vista.classList.remove("hidden");
    if (navElement) {
        navElement.classList.replace("text-slate-400", "text-purple-800");
        navElement.classList.add("font-bold");
    }
    // Inicializar iconos de Lucide cargados dinámicamente
    if (window.lucide) window.lucide.createIcons();
}

// Escuchas de Navegación Inferior
navInventario.addEventListener("click", () => mostrarVista(viewInventario, navInventario));
navBalance.addEventListener("click", () => {
    if (isAdmin) mostrarVista(viewBalance, navBalance);
});
navAjustes.addEventListener("click", () => {
    if (isAdmin) mostrarVista(viewAjustes, navAjustes));
});

btnEstadoSesion.addEventListener("click", () => {
    if (!isAdmin) {
        mostrarVista(viewLogin, null);
    } else {
        mostrarVista(viewAjustes, navAjustes);
    }
});

// Cancelar Login
document.getElementById("btn-cancelar-login").addEventListener("click", () => {
    mostrarVista(viewInventario, navInventario);
});

// ==========================================
// 2. CONTROL DE SESIÓN (FIREBASE AUTH)
// ==========================================
onAuthStateChanged(auth, (user) => {
    const wrapperAcciones = document.getElementById("wrapper-acciones-inventario");
    if (user) {
        isAdmin = true;
        txtEstadoSesion.textContent = "Admin";
        navBalance.classList.remove("hidden");
        navAjustes.classList.remove("hidden");
        if (wrapperAcciones) wrapperAcciones.classList.remove("hidden");
        mostrarVista(viewBalance, navBalance);
    } else {
        isAdmin = false;
        txtEstadoSesion.textContent = "Login";
        navBalance.classList.add("hidden");
        navAjustes.classList.add("hidden");
        if (wrapperAcciones) wrapperAcciones.classList.add("hidden");
        mostrarVista(viewInventario, navInventario);
    }
    procesarYRenderizarTodo();
});

// Formulario de Inicio de Sesión
document.getElementById("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        document.getElementById("form-login").reset();
    } catch (error) {
        alert("Credenciales incorrectas de administrador. Intenta de nuevo.");
    }
});

// Cierre de Sesión
document.getElementById("btn-cerrar-sesion").addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        alert("Error al cerrar sesión.");
    }
});

// ==========================================
// 3. CAPTURA Y ESCUCHA EN TIEMPO REAL (FIRESTORE)
// ==========================================
function iniciarEscuchasNube() {
    // Escucha de Productos
    onSnapshot(query(collection(db, "productos")), (snapshot) => {
        listaProductosGlobal = [];
        snapshot.forEach(doc => {
            listaProductosGlobal.push({ id: doc.id, ...doc.data() });
        });
        procesarYRenderizarTodo();
        actualizarSelectoresModales();
    });

    // Escucha de Combos / Kits
    onSnapshot(query(collection(db, "combos")), (snapshot) => {
        listaCombosGlobal = [];
        snapshot.forEach(doc => {
            listaCombosGlobal.push({ id: doc.id, ...doc.data() });
        });
        procesarYRenderizarTodo();
        actualizarSelectoresModales();
    });

    // Escucha de Transacciones / Ventas
    onSnapshot(query(collection(db, "transacciones"), orderBy("fecha", "desc")), (snapshot) => {
        listaTransaccionesGlobal = [];
        snapshot.forEach(doc => {
            listaTransaccionesGlobal.push({ id: doc.id, ...doc.data() });
        });
        procesarYRenderizarTodo();
    });

    // Escucha de Caja Fuerte
    iniciarEscuchaCajaFuerte();
}

// ==========================================
// 4. MOTOR CONTABLE Y RENDERIZACIÓN GENERAL
// ==========================================
let filtroPeriodoActual = "mes"; // Por defecto "mes"

function procesarYRenderizarTodo() {
    let ventasTotales = 0;
    let costosTotales = 0;
    let cuentasPorCobrar = 0;

    const ahora = new Date();
    const hoyStr = ahora.toISOString().split('T')[0];

    // Calcular inicio de semana (Lunes)
    const diaSemana = ahora.getDay();
    const diferenciaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
    const lunesSemana = new Date(ahora);
    lunesSemana.setDate(ahora.getDate() + diferenciaLunes);
    const lunesSemanaStr = lunesSemana.toISOString().split('T')[0];

    // Calcular inicio de mes
    const primerDiaMesStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`;

    // 1. Procesamiento de Transacciones con Filtro de Tiempo
    const transaccionesFiltradas = listaTransaccionesGlobal.filter(t => {
        if (!t.fecha) return false;
        const fechaVentaStr = t.fecha.split(' ')[0];

        if (filtroPeriodoActual === "hoy") {
            return fechaVentaStr === hoyStr;
        } else if (filtroPeriodoActual === "semana") {
            return fechaVentaStr >= lunesSemanaStr && fechaVentaStr <= hoyStr;
        } else {
            return fechaVentaStr >= primerDiaMesStr && fechaVentaStr <= hoyStr;
        }
    });

    // Calcular KPIs según el filtro seleccionado
    transaccionesFiltradas.forEach(t => {
        const valorVenta = parseFloat(t.precioCobrado) || 0;
        const valorCosto = parseFloat(t.costoInversion) || 0;
        const envioSubsidiado = parseFloat(t.envioAsumido) || 0;

        if (t.estadoPago === "pendiente") {
            cuentasPorCobrar += valorVenta;
        } else {
            ventasTotales += valorVenta;
            // El costo total indexa la inversión del producto + lo que se subsidió de envío
            costosTotales += (valorCosto + envioSubsidiado);
        }
    });

    const gananciaNetaPeriodo = ventasTotales - costosTotales;
    const utilidadLibreCaja = gananciaNetaPeriodo - retirosAcumulados;
    const efectivoTotalCaja = capitalBaseFijo + utilidadLibreCaja;

    // Pintar KPIs en el Balance (Solo Admin)
    if (isAdmin) {
        document.getElementById("bal-ganancia-neta").textContent = `$${gananciaNetaPeriodo.toLocaleString()}`;
        document.getElementById("bal-total-ventas").textContent = `$${ventasTotales.toLocaleString()}`;
        document.getElementById("bal-total-costos").textContent = `$${costosTotales.toLocaleString()}`;
        document.getElementById("bal-total-deudas").textContent = `$${cuentasPorCobrar.toLocaleString()}`;

        document.getElementById("caja-capital-base").textContent = `$${capitalBaseFijo.toLocaleString()}`;
        document.getElementById("caja-ganancia-libre").textContent = `$${utilidadLibreCaja.toLocaleString()}`;
        document.getElementById("caja-efectivo-total").textContent = `$${efectivoTotalCaja.toLocaleString()}`;

        renderizarHistorialTransacciones(transaccionesFiltradas);
    }

    // 2. Renderizar Inventario Público / Catálogo y Alertas de Stock
    renderizarCatalogoYAlertas();
}

// Configuración de los botones de filtro de tiempo
document.getElementById("filtro-hoy").addEventListener("click", () => cambiarFiltroPeriodo("hoy"));
document.getElementById("filtro-semana").addEventListener("click", () => cambiarFiltroPeriodo("semana"));
document.getElementById("filtro-mes").addEventListener("click", () => cambiarFiltroPeriodo("mes"));

function cambiarFiltroPeriodo(periodo) {
    filtroPeriodoActual = periodo;
    ["hoy", "semana", "mes"].forEach(p => {
        const btn = document.getElementById(`filtro-${p}`);
        if (p === periodo) {
            btn.classList.replace("bg-slate-200", "bg-purple-600");
            btn.classList.replace("text-slate-700", "text-white");
        } else {
            btn.classList.replace("bg-purple-600", "bg-slate-200");
            btn.classList.replace("text-white", "text-slate-700");
        }
    });
    procesarYRenderizarTodo();
}

// ==========================================
// 5. SECCIÓN DE REPORTES Y EXPORTACIÓN CLEAN
// ==========================================
window.exportarHistorialMensual = function() {
    if (listaTransaccionesGlobal.length === 0) {
        alert("No hay operaciones registradas en el historial para exportar.");
        return;
    }

    let contenidoReporte = `==================================================\n`;
    contenidoReporte += `          DAESMI - REPORTES FINANCIEROS          \n`;
    contenidoReporte += `==================================================\n`;
    contenidoReporte += `Fecha de Extracción: ${new Date().toLocaleString()}\n\n`;
    contenidoReporte += `DETALLE DE OPERACIONES REGISTRADAS:\n`;
    contenidoReporte += `--------------------------------------------------\n`;

    listaTransaccionesGlobal.forEach((t, i) => {
        contenidoReporte += `[#${i + 1}] Fca: ${t.fecha}\n`;
        contenidoReporte += `     Art: ${t.articuloNombre}\n`;
        contenidoReporte += `     Cobro: $${parseFloat(t.precioCobrado).toLocaleString()} COP | Costo Inversión: $${parseFloat(t.costoInversion).toLocaleString()} COP\n`;
        contenidoReporte += `     Envío Subsidiado: $${(parseFloat(t.envioAsumido) || 0).toLocaleString()} COP\n`;
        contenidoReporte += `     Recaudo: ${t.estadoPago === 'pago' ? 'COMPLETO / EFECTIVO' : 'CUENTA POR COBRAR'}\n`;
        contenidoReporte += `--------------------------------------------------\n`;
    });

    const blob = new Blob([contenidoReporte], { type: "text/plain;charset=utf-8" });
    const enlaceDescarga = document.createElement("a");
    enlaceDescarga.href = URL.createObjectURL(blob);
    enlaceDescarga.download = `DAESMI_Balance_Mensual_${new Date().toISOString().split('T')[0]}.txt`;
    enlaceDescarga.click();
};

// ==========================================
// 6. RENDERIZACIÓN DE CATÁLOGO, VARIACIONES Y CATEGORÍAS
// ==========================================
let categoriaSeleccionadaGlobal = "TODOS";

function renderizarCatalogoYAlertas() {
    const contenedorAlertas = document.getElementById("contenedor-alertas-stock");
    const contenedorCatalogo = document.getElementById("lista-inventario");
    const contenedorTopClientes = document.getElementById("lista-top-productos-cliente");
    const seccionDestacados = document.getElementById("seccion-destacados-cliente");
    const contenedorCategorias = document.getElementById("barras-categorias-filtro");

    contenedorAlertas.innerHTML = "";
    contenedorCatalogo.innerHTML = "";
    contenedorTopClientes.innerHTML = "";

    let alertasInyectadas = 0;
    let mapaCategorias = new Set();

    // 1. Extraer categorías únicas de los productos existentes
    listaProductosGlobal.forEach(p => {
        if (p.categoria) mapaCategorias.add(p.categoria.trim().toUpperCase());
    });

    // Renderizar barra de categorías horizontal
    let categoriasHTML = `<button onclick="window.filtrarCatalogoPorCategoria('TODOS')" class="px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-wide transition-all shrink-0 cursor-pointer ${categoriaSeleccionadaGlobal === 'TODOS' ? 'bg-purple-900 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-500'}">Todos</button>`;
    
    mapaCategorias.forEach(cat => {
        categoriasHTML += `<button onclick="window.filtrarCatalogoPorCategoria('${cat}')" class="px-3.5 py-1.5 rounded-full text-[11px] font-black tracking-wide transition-all shrink-0 cursor-pointer ${categoriaSeleccionadaGlobal === cat ? 'bg-purple-900 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-500'}">${cat.charAt(0) + cat.slice(1).toLowerCase()}</button>`;
    });
    contenedorCategorias.innerHTML = categoriasHTML;

    // 2. Procesar Alertas Críticas de Surtido de Stock (Solo Admin)
    if (isAdmin) {
        listaProductosGlobal.forEach(p => {
            if (parseInt(p.stock) <= 2) {
                alertasInyectadas++;
                const div = document.createElement("div");
                div.className = "bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl text-[11px] font-bold flex justify-between items-center shadow-3xs";
                div.innerHTML = `
                    <span class="flex items-center gap-1.5"><i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-600"></i> Stock crítico de: ${p.nombre} (${p.stock} unds)</span>
                    <button onclick="window.abrirEditarProducto('${p.id}')" class="bg-amber-600 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase cursor-pointer">Surtir</button>
                `;
                contenedorAlertas.appendChild(div);
            }
        });
        contenedorAlertas.classList.toggle("hidden", alertasInyectadas === 0);
    } else {
        contenedorAlertas.classList.add("hidden");
    }

    // 3. Procesar y Pintar Top 3 Más Vendidos para Clientes (Basado en historial histórico)
    let conteoVentasProductos = {};
    listaTransaccionesGlobal.forEach(t => {
        if (t.articuloId) {
            conteoVentasProductos[t.articuloId] = (conteoVentasProductos[t.articuloId] || 0) + 1;
        }
    });

    let productosOrdenadosPorVenta = [...listaProductosGlobal].sort((a, b) => {
        return (conteoVentasProductos[b.id] || 0) - (conteoVentasProductos[a.id] || 0);
    });

    let topPintados = 0;
    productosOrdenadosPorVenta.forEach(p => {
        if (topPintados < 3 && (conteoVentasProductos[p.id] || 0) > 0 && parseInt(p.stock) > 0) {
            topPintados++;
            
            // Selector de variaciones para el bloque de destacados
            let selectorVariacionDestacadoHTML = '';
            if (p.variacion && p.variacion.opciones && p.variacion.opciones.length > 0) {
                selectorVariacionDestacadoHTML = `
                    <div class="mt-1">
                        <select id="select-variant-top-${p.id}" class="w-full bg-slate-50 border border-slate-200 p-1 rounded-lg text-[10px] font-bold text-slate-700 focus:outline-hidden">
                            ${p.variacion.opciones.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                    </div>
                `;
            }

            const cardTop = `
                <div class="bg-gradient-to-r from-purple-900 to-purple-950 text-white p-2.5 rounded-2xl flex gap-3 items-center relative overflow-hidden shadow-sm">
                    <img src="${p.foto}" class="w-12 h-12 object-cover rounded-xl bg-white/10 shrink-0">
                    <div class="flex-1 min-w-0">
                        <p class="text-[8px] font-black uppercase tracking-widest text-pink-300">🔥 LOS MÁS AMADOS</p>
                        <h4 class="font-bold text-xs truncate leading-tight">${p.nombre}</h4>
                        ${selectorVariacionDestacadoHTML}
                    </div>
                    <div class="text-right shrink-0 flex items-center gap-2">
                        <span class="font-black text-xs text-pink-200">$${p.precio.toLocaleString()}</span>
                        <button onclick="window.agregarAlCarritoConVariacion('${p.id}', true)" class="bg-white text-purple-950 p-1 rounded-lg font-black active:scale-95 transition-transform cursor-pointer">
                            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `;
            contenedorTopClientes.insertAdjacentHTML("beforeend", cardTop);
        }
    });
    seccionDestacados.classList.toggle("hidden", topPintados === 0 || isAdmin);

    // 4. Catálogo Combinado (Productos Simples + Combos Estacionales)
    const terminoBusqueda = document.getElementById("input-busqueda").value.toLowerCase();

    // Inyectar Combos / Kits Estacionales (Ignoran filtro de categoría ya que combinan líneas)
    listaCombosGlobal.forEach(c => {
        if (categoriaSeleccionadaGlobal !== "TODOS") return; 
        if (c.nombre.toLowerCase().includes(terminoBusqueda) || (c.descripcion && c.descripcion.toLowerCase().includes(terminoBusqueda))) {
            const cardCombo = `
                <div class="bg-white p-3 rounded-3xl border-2 border-purple-100 shadow-2xs flex gap-3 relative overflow-hidden">
                    <div class="absolute top-0 left-0 bg-purple-900 text-white font-black text-[7px] uppercase tracking-widest px-2 py-0.5 rounded-br-xl">Combo Kit</div>
                    <img src="${c.foto || 'https://placehold.co/300x350/eae6f8/6b21a8?text=KIT'}" class="w-20 h-20 object-cover rounded-2xl bg-slate-50 self-center shrink-0 mt-1">
                    <div class="flex-1 flex flex-col justify-between pt-1">
                        <div>
                            <h4 class="font-black text-slate-900 text-xs leading-tight">${c.nombre}</h4>
                            <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5">${c.descripcion || ''}</p>
                        </div>
                        <div class="flex justify-between items-center mt-2">
                            <span class="font-black text-purple-950 text-sm">$${parseFloat(c.precioCombo).toLocaleString()}</span>
                            <div class="flex gap-1">
                                ${isAdmin ? `
                                    <button type="button" onclick="window.abrirEditarCombo('${c.id}')" class="bg-slate-100 text-slate-700 p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>
                                    <button type="button" onclick="window.eliminarComboNube('${c.id}')" class="bg-rose-50 text-rose-600 p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide="trash" class="w-3.5 h-3.5"></i></button>
                                ` : `
                                    <button type="button" onclick="window.agregarComboAlCarrito('${c.id}')" class="bg-purple-900 text-white p-1.5 rounded-xl font-bold cursor-pointer active:scale-95 transition-all shadow-xs"><i data-lucide="plus" class="w-4 h-4"></i></button>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            contenedorCatalogo.insertAdjacentHTML("beforeend", cardCombo);
        }
    });

    // Inyectar Productos Físicos Simples
    listaProductosGlobal.forEach(p => {
        if (categoriaSeleccionadaGlobal !== "TODOS" && p.categoria.trim().toUpperCase() !== categoriaSeleccionadaGlobal) return;

        if (p.nombre.toLowerCase().includes(terminoBusqueda) || p.categoria.toLowerCase().includes(terminoBusqueda)) {
            const enStock = parseInt(p.stock) > 0;
            
            // Selector dinámico si el producto tiene variaciones creadas
            let selectorVariacionHTML = '';
            if (p.variacion && p.variacion.opciones && p.variacion.opciones.length > 0) {
                selectorVariacionHTML = `
                    <div class="mt-1.5">
                        <label class="block text-[8px] font-black text-purple-900 uppercase mb-0.5">Elegir ${p.variacion.titulo}:</label>
                        <select id="select-variant-${p.id}" class="w-full bg-slate-50 border border-slate-200 p-1 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-hidden">
                            ${p.variacion.opciones.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                    </div>
                `;
            }

            const cardProd = `
                <div class="bg-white p-3 rounded-3xl border border-slate-100 shadow-2xs flex gap-3 relative ${!enStock && !isAdmin ? 'opacity-50' : ''}">
                    <img src="${p.foto}" class="w-20 h-20 object-cover rounded-2xl bg-slate-50 self-center shrink-0">
                    <div class="flex-1 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start">
                                <span class="text-[8px] font-black text-purple-600 uppercase tracking-wider">${p.categoria}</span>
                                ${isAdmin ? `<span class="text-[9px] font-bold ${enStock ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-1.5 py-0.5 rounded-md">Stock: ${p.stock}</span>` : ''}
                            </div>
                            <h4 class="font-bold text-slate-800 text-xs leading-tight mt-0.5">${p.nombre}</h4>
                            <p class="text-[10px] text-slate-400 line-clamp-1 mt-0.5">${p.descripcion || ''}</p>
                            ${selectorVariacionHTML}
                        </div>
                        <div class="flex justify-between items-center mt-2">
                            <div class="flex flex-col">
                                <span class="font-black text-purple-950 text-sm">$${p.precio.toLocaleString()}</span>
                                ${isAdmin ? `<span class="text-[8px] text-slate-400 font-bold">Costo: $${p.costo.toLocaleString()}</span>` : ''}
                            </div>
                            <div class="flex gap-1">
                                ${isAdmin ? `
                                    <button type="button" onclick="window.abrirEditarProducto('${p.id}')" class="bg-slate-100 text-slate-700 p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>
                                    <button type="button" onclick="window.eliminarProductoNube('${p.id}')" class="bg-rose-50 text-rose-600 p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide="trash" class="w-3.5 h-3.5"></i></button>
                                ` : `
                                    <button type="button" ${enStock ? `onclick="window.agregarAlCarritoConVariacion('${p.id}', false)"` : 'disabled'} class="${enStock ? 'bg-purple-900 text-white cursor-pointer active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'} p-1.5 rounded-xl font-bold transition-all shadow-xs">
                                        <i data-lucide="${enStock ? 'plus' : 'slash'}" class="w-4 h-4"></i>
                                    </button>
                                `}
                                ${isAdmin ? `
                                    <button type="button" onclick="window.detonarMarketingProducto('${p.id}')" class="bg-purple-100 text-purple-800 p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i></button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            contenedorCatalogo.insertAdjacentHTML("beforeend", cardProd);
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

// Filtro por categorías activado por los botones
window.filtrarCatalogoPorCategoria = function(cat) {
    categoriaSeleccionadaGlobal = cat;
    renderizarCatalogoYAlertas();
};

// Escucha del campo de búsqueda
document.getElementById("input-busqueda").addEventListener("input", renderizarCatalogoYAlertas);

// ==========================================
// 7. INTERFAZ Y LÓGICA DE LA BOLSA (CARRITO)
// ==========================================
window.agregarAlCarritoConVariacion = function(id, desdeTop = false) {
    const prod = listaProductosGlobal.find(p => p.id === id);
    if (!prod) return;

    let variacionSeleccionada = null;
    
    // Capturar el valor según la procedencia del clic (Catálogo o Top 3)
    const selectElement = desdeTop 
        ? document.getElementById(`select-variant-top-${id}`) 
        : document.getElementById(`select-variant-${id}`);
    
    if (selectElement) {
        variacionSeleccionada = {
            titulo: prod.variacion.titulo,
            valor: selectElement.value
        };
    }

    // Crear llave única para separar ítems por variante en la bolsa
    const carritoKey = variacionSeleccionada ? `${id}-${variacionSeleccionada.valor}` : id;
    const itemExistente = carritoGlobal.find(item => item.key === carritoKey);

    if (itemExistente) {
        if (itemExistente.cantidad >= prod.stock) {
            alert(`Lo sentimos, solo tenemos ${prod.stock} unidades disponibles de esta opción.`);
            return;
        }
        itemExistente.cantidad++;
    } else {
        carritoGlobal.push({
            key: carritoKey,
            id: id,
            tipo: "simple",
            nombre: prod.nombre,
            precio: prod.precio,
            costo: prod.costo,
            variante: variacionSeleccionada, // {titulo: "Color", valor: "Negro"}
            cantidad: 1
        });
    }

    window.actualizarInterfazCarrito();
};

window.agregarComboAlCarrito = function(id) {
    const combo = listaCombosGlobal.find(c => c.id === id);
    if (!combo) return;

    const itemExistente = carritoGlobal.find(item => item.key === id);

    if (itemExistente) {
        itemExistente.cantidad++;
    } else {
        carritoGlobal.push({
            key: id,
            id: id,
            tipo: "combo",
            nombre: combo.nombre,
            precio: parseFloat(combo.precioCombo),
            costo: parseFloat(combo.costoCombo || 0),
            variante: null,
            cantidad: 1
        });
    }

    window.actualizarInterfazCarrito();
};

window.actualizarInterfazCarrito = function() {
    const barra = document.getElementById("barra-flotante-carrito");
    const badge = document.getElementById("carrito-badge-conteo");
    
    const conteoTotal = carritoGlobal.reduce((acc, item) => acc + item.cantidad, 0);
    badge.textContent = conteoTotal;

    if (conteoTotal > 0 && !isAdmin) {
        barra.classList.replace("hidden", "flex");
    } else {
        barra.classList.replace("flex", "hidden");
    }
};

window.abrirModalCarritoCompleto = function() {
    const modal = document.getElementById("modal-carrito-cliente");
    const contenedorItems = document.getElementById("carrito-lista-items");
    const totalMonto = document.getElementById("carrito-total-monto");

    contenedorItems.innerHTML = "";
    let acumuladoDinero = 0;

    carritoGlobal.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        acumuladoDinero += subtotal;

        const varianteTexto = item.variante ? `<p class="text-[10px] text-purple-800 font-bold bg-purple-50 px-1 rounded-sm w-fit">${item.variante.titulo}: ${item.variante.valor}</p>` : '';

        const renglon = `
            <div class="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div class="min-w-0 flex-1">
                    <h5 class="font-bold text-xs text-slate-800 truncate">${item.nombre}</h5>
                    ${varianteTexto}
                    <p class="text-[10px] text-slate-400 font-medium">${item.cantidad}x $${item.precio.toLocaleString()}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0 ml-2">
                    <span class="font-black text-xs text-purple-950">$${subtotal.toLocaleString()}</span>
                    <button onclick="window.eliminarLineaCarrito('${item.key}')" class="text-rose-500 font-bold text-xs px-1 cursor-pointer">✕</button>
                </div>
            </div>
        `;
        contenedorItems.insertAdjacentHTML("beforeend", renglon);
    });

    totalMonto.textContent = `$${acumuladoDinero.toLocaleString()}`;
    modal.classList.replace("hidden", "flex");
};

window.cerrarModalCarritoCompleto = function() {
    document.getElementById("modal-carrito-cliente").classList.replace("flex", "hidden");
};

window.eliminarLineaCarrito = function(key) {
    carritoGlobal = carritoGlobal.filter(item => item.key !== key);
    window.actualizarInterfazCarrito();
    if (carritoGlobal.length > 0) {
        window.abrirModalCarritoCompleto();
    } else {
        window.cerrarModalCarritoCompleto();
    }
};

window.enviarPedidoWhatsApp = function() {
    if (carritoGlobal.length === 0) return;

    let mensaje = `*🛍️ NUEVO PEDIDO - DAESMI*\n`;
    mensaje += `Hola, quiero comprar los siguientes artículos de tu catálogo:\n\n`;

    let total = 0;
    carritoGlobal.forEach(item => {
        const varianteTxt = item.variante ? ` [${item.variante.titulo}: ${item.variante.valor}]` : '';
        mensaje += `• *${item.cantidad}x* ${item.nombre}${varianteTxt}\n  Subtotal: $${(item.precio * item.cantidad).toLocaleString()} COP\n`;
        total += item.precio * item.cantidad;
    });

    mensaje += `\n*💰 TOTAL ESTIMADO:* $${total.toLocaleString()} COP\n`;
    mensaje += `\nQuedo atenta para coordinar el pago y envío. ¡Muchas gracias! ✨`;

    const url = `https://api.whatsapp.com/send?phone=573022152560&text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");

    // Resetear el carrito tras el despacho
    carritoGlobal = [];
    window.actualizarInterfazCarrito();
    window.cerrarModalCarritoCompleto();
};

// ==========================================
// 8. HISTORIAL DE VENTAS ADMINISTRATIVAS
// ==========================================
function renderizarHistorialTransacciones(arreglo) {
    const contenedor = document.getElementById("lista-transacciones");
    contenedor.innerHTML = "";

    if (arreglo.length === 0) {
        contenedor.innerHTML = `<p class="text-center text-[11px] text-slate-400 py-4 font-medium">No hay operaciones registradas en este lapso.</p>`;
        return;
    }

    arreglo.forEach(t => {
        const total = parseFloat(t.precioCobrado) || 0;
        const costo = parseFloat(t.costoInversion) || 0;
        const envioSubsidiado = parseFloat(t.envioAsumido) || 0;
        const ganancia = t.estadoPago === "pendiente" ? 0 : (total - (costo + envioSubsidiado));

        const cardTransaccion = `
            <div class="bg-white p-3 rounded-2xl border border-slate-100 shadow-3xs flex justify-between items-center gap-2">
                <div class="min-w-0">
                    <p class="text-[8px] text-slate-400 font-bold uppercase">${t.fecha || ''}</p>
                    <h4 class="font-bold text-xs text-slate-800 truncate leading-tight">${t.articuloNombre}</h4>
                    <div class="flex gap-1.5 text-[9px] mt-0.5">
                        <span class="font-medium text-slate-500">Cobro: $${total.toLocaleString()}</span>
                        ${envioSubsidiado > 0 ? `<span class="text-rose-500 font-bold">Envío: -$${envioSubsidiado.toLocaleString()}</span>` : ''}
                        <span class="${t.estadoPago === 'pago' ? 'text-emerald-600 font-bold bg-emerald-50' : 'text-amber-600 font-bold bg-amber-50'} px-1 rounded">
                            ${t.estadoPago === 'pago' ? 'Cobrado' : 'Deuda'}
                        </span>
                    </div>
                </div>
                <div class="text-right shrink-0 flex items-center gap-1.5">
                    <div>
                        <p class="text-[8px] font-bold text-slate-400 uppercase">Utilidad</p>
                        <p class="text-xs font-black ${ganancia >= 0 ? 'text-purple-950' : 'text-rose-500'}">$${ganancia.toLocaleString()}</p>
                    </div>
                    <button onclick="window.eliminarTransaccionYReversarStock('${t.id}')" class="text-slate-300 hover:text-rose-600 p-1 transition-colors cursor-pointer">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
        `;
        contenedor.insertAdjacentHTML("beforeend", cardTransaccion);
    });

    if (window.lucide) window.lucide.createIcons();
}

// ==========================================
// 9. MODAL: GESTIÓN DE PRODUCTOS (ADMIN)
// ==========================================
const modalProducto = document.getElementById("modal-producto");
const formProducto = document.getElementById("form-producto");

document.getElementById("btn-nuevo-producto").addEventListener("click", () => {
    idProductoEditando = null;
    formProducto.reset();
    document.getElementById("sector-campos-variaciones").classList.add("hidden");
    modalProducto.classList.replace("hidden", "flex");
});

document.getElementById("btn-cerrar-modal-prod").addEventListener("click", () => {
    modalProducto.classList.replace("flex", "hidden");
});

// Guardar / Editar Producto
formProducto.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    // Procesar variaciones dinámicas si el check está activo
    const tieneVariaciones = document.getElementById("prod-tiene-variaciones").checked;
    let variacionData = null;

    if (tieneVariaciones) {
        const titulo = document.getElementById("prod-titulo-variacion").value.trim();
        const opcionesRaw = document.getElementById("prod-opciones-variacion").value;
        const opciones = opcionesRaw.split(",").map(o => o.trim()).filter(o => o.length > 0);

        if (titulo && opciones.length > 0) {
            variacionData = { titulo, opciones };
        }
    }

    const payload = {
        nombre: document.getElementById("prod-nombre").value.trim(),
        categoria: document.getElementById("prod-categoria").value.trim(),
        descripcion: document.getElementById("prod-descripcion").value.trim(),
        foto: document.getElementById("prod-foto").value.trim() || "https://placehold.co/300x350/eae6f8/6b21a8?text=DAESMI",
        costo: parseFloat(document.getElementById("prod-costo").value) || 0,
        precio: parseFloat(document.getElementById("prod-precio").value) || 0,
        stock: parseInt(document.getElementById("prod-stock").value) || 0,
        variacion: variacionData
    };

    try {
        if (idProductoEditando) {
            await updateDoc(doc(db, "productos", idProductoEditando), payload);
            alert("Producto actualizado en el catálogo.");
        } else {
            await addDoc(collection(db, "productos"), payload);
            alert("Nuevo producto indexado correctamente.");
        }
        modalProducto.classList.replace("flex", "hidden");
        formProducto.reset();
    } catch (err) {
        alert("Error de guardado en la base de datos.");
    }
});

window.abrirEditarProducto = function(id) {
    const p = listaProductosGlobal.find(item => item.id === id);
    if (!p) return;

    idProductoEditando = id;
    document.getElementById("prod-nombre").value = p.nombre;
    document.getElementById("prod-categoria").value = p.categoria;
    document.getElementById("prod-descripcion").value = p.descripcion || "";
    document.getElementById("prod-foto").value = p.foto;
    document.getElementById("prod-costo").value = p.costo;
    document.getElementById("prod-precio").value = p.precio;
    document.getElementById("prod-stock").value = p.stock;

    const checkVariacion = document.getElementById("prod-tiene-variaciones");
    const sectorVariacion = document.getElementById("sector-campos-variaciones");

    if (p.variacion) {
        checkVariacion.checked = true;
        sectorVariacion.classList.remove("hidden");
        document.getElementById("prod-titulo-variacion").value = p.variacion.titulo || "";
        document.getElementById("prod-opciones-variacion").value = (p.variacion.opciones || []).join(", ");
    } else {
        checkVariacion.checked = false;
        sectorVariacion.classList.add("hidden");
        document.getElementById("prod-titulo-variacion").value = "";
        document.getElementById("prod-opciones-variacion").value = "";
    }

    modalProducto.classList.replace("hidden", "flex");
};

window.eliminarProductoNube = async function(id) {
    if (!isAdmin) return;
    if (confirm("¿Estás segura de que deseas borrar este cosmético del catálogo?")) {
        await deleteDoc(doc(db, "productos", id));
    }
};

// ==========================================
// 10. MODAL: ARMADO DE COMBOS / KITS (ADMIN)
// ==========================================
const modalCombo = document.getElementById("modal-combo");
const formCombo = document.getElementById("form-combo");
const comboSelect = document.getElementById("combo-select-producto");
const ulComboTemporal = document.getElementById("combo-lista-productos-temporal");

document.getElementById("btn-nuevo-combo").addEventListener("click", () => {
    idComboEditando = null;
    itemsComboTemporal = [];
    formCombo.reset();
    renderizarItemsComboTemporal();
    modalCombo.classList.replace("hidden", "flex");
});

document.getElementById("btn-dash-combo").addEventListener("click", () => {
    if (!isAdmin) return;
    idComboEditando = null;
    itemsComboTemporal = [];
    formCombo.reset();
    renderizarItemsComboTemporal();
    modalCombo.classList.replace("hidden", "flex");
});

document.getElementById("btn-cerrar-modal-combo").addEventListener("click", () => {
    modalCombo.classList.replace("flex", "hidden");
});

function actualizarSelectoresModales() {
    comboSelect.innerHTML = "";
    const selectVenta = document.getElementById("venta-select-item");
    selectVenta.innerHTML = `<option value="" disabled selected>Selecciona una opción...</option>`;

    // Rellenar select del constructor de combos
    listaProductosGlobal.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.nombre} (Stock: ${p.stock})`;
        comboSelect.appendChild(opt);
    });

    // Rellenar select del asentamiento de ventas con grupos lógicos
    const grupoSimples = document.createElement("optgroup");
    grupoSimples.label = "Cosméticos Simples";
    listaProductosGlobal.forEach(p => {
        const opt = document.createElement("option");
        opt.value = `simple|${p.id}`;
        opt.textContent = `${p.nombre} ($${p.precio.toLocaleString()})`;
        grupoSimples.appendChild(opt);
    });

    const grupoCombos = document.createElement("optgroup");
    grupoCombos.label = "Kits / Combos Estacionales";
    listaCombosGlobal.forEach(c => {
        const opt = document.createElement("option");
        opt.value = `combo|${c.id}`;
        opt.textContent = `${c.nombre} ($${parseFloat(c.precioCombo).toLocaleString()})`;
        grupoCombos.appendChild(opt);
    });

    selectVenta.appendChild(grupoSimples);
    selectVenta.appendChild(grupoCombos);
}

document.getElementById("btn-agregar-item-combo").addEventListener("click", () => {
    const id = comboSelect.value;
    const prod = listaProductosGlobal.find(p => p.id === id);
    if (!prod) return;

    itemsComboTemporal.push({ id: prod.id, nombre: prod.nombre, costo: prod.costo, precio: prod.precio });
    renderizarItemsComboTemporal();
});

function renderizarItemsComboTemporal() {
    ulComboTemporal.innerHTML = "";
    let inversionCosto = 0;
    let precioVentaSeparado = 0;

    itemsComboTemporal.forEach((item, index) => {
        inversionCosto += item.costo;
        precioVentaSeparado += item.precio;

        const li = document.createElement("li");
        li.className = "flex justify-between items-center text-[10px] bg-white border p-1 rounded-lg font-medium";
        li.innerHTML = `
            <span class="truncate">${item.nombre}</span>
            <button type="button" onclick="window.removerItemComboTemporal(${index})" class="text-rose-500 font-bold ml-1 px-1">✕</button>
        `;
        ulComboTemporal.appendChild(li);
    });

    document.getElementById("combo-costo-calculated").textContent = `$${inversionCosto.toLocaleString()}`;
    document.getElementById("combo-precio-base-sugerido").textContent = `$${precioVentaSeparado.toLocaleString()}`;
}

window.removerItemComboTemporal = function(index) {
    itemsComboTemporal.splice(index, 1);
    renderizarItemsComboTemporal();
};

formCombo.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (itemsComboTemporal.length === 0) {
        alert("Debes vincular al menos un cosmético para poder lanzar el kit.");
        return;
    }

    const totalCosto = itemsComboTemporal.reduce((acc, i) => acc + i.costo, 0);

    const payload = {
        nombre: document.getElementById("combo-nombre").value.trim(),
        descripcion: document.getElementById("combo-descripcion").value.trim(),
        foto: document.getElementById("combo-foto").value.trim(),
        precioCombo: parseFloat(document.getElementById("combo-precio-venta").value) || 0,
        costoCombo: totalCosto,
        productosVinculados: itemsComboTemporal
    };

    try {
        if (idComboEditando) {
            await updateDoc(doc(db, "combos", idComboEditando), payload);
            alert("Kit Estacional actualizado correctamente.");
        } else {
            await addDoc(collection(db, "combos"), payload);
            alert("¡Combo lanzado al mercado con éxito!");
        }
        modalCombo.classList.replace("flex", "hidden");
        formCombo.reset();
        itemsComboTemporal = [];
    } catch (err) {
        alert("Error de conexión al salvar el combo.");
    }
});

window.abrirEditarCombo = function(id) {
    const c = listaCombosGlobal.find(item => item.id === id);
    if (!c) return;

    idComboEditando = id;
    document.getElementById("combo-nombre").value = c.nombre;
    document.getElementById("combo-descripcion").value = c.descripcion || "";
    document.getElementById("combo-foto").value = c.foto || "";
    document.getElementById("combo-precio-venta").value = c.precioCombo;

    itemsComboTemporal = [...(c.productosVinculados || [])];
    renderizarItemsComboTemporal();
    modalCombo.classList.replace("hidden", "flex");
};

window.eliminarComboNube = async function(id) {
    if (!isAdmin) return;
    if (confirm("¿Quieres eliminar de forma definitiva este Combo Kit?")) {
        await deleteDoc(doc(db, "combos", id));
    }
};

// ==========================================
// 11. MODAL: ASENTAMIENTO DE VENTAS MANUAL (ADMIN)
// ==========================================
const modalVenta = document.getElementById("modal-venta");
const formVenta = document.getElementById("form-venta");
const selectVentaItem = document.getElementById("venta-select-item");
const inputPrecioFinal = document.getElementById("venta-precio-final");

document.getElementById("btn-dash-venta").addEventListener("click", () => {
    if (!isAdmin) return;
    formVenta.reset();
    document.getElementById("contenedor-envio-asumido").classList.add("hidden");
    modalVenta.classList.replace("hidden", "flex");
});

document.getElementById("btn-cerrar-modal-venta").addEventListener("click", () => {
    modalVenta.classList.replace("flex", "hidden");
});

selectVentaItem.addEventListener("change", () => {
    const tokens = selectVentaItem.value.split("|");
    const tipo = tokens[0];
    const id = tokens[1];

    if (tipo === "simple") {
        const prod = listaProductosGlobal.find(p => p.id === id);
        if (prod) inputPrecioFinal.value = prod.precio;
    } else {
        const combo = listaCombosGlobal.find(c => c.id === id);
        if (combo) inputPrecioFinal.value = combo.precioCombo;
    }
});

formVenta.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const tokens = selectVentaItem.value.split("|");
    const tipo = tokens[0];
    const id = tokens[1];

    let nombreArticulo = "";
    let inversionCosto = 0;

    if (tipo === "simple") {
        const prod = listaProductosGlobal.find(p => p.id === id);
        if (!prod) return;
        if (prod.stock <= 0) {
            alert("No hay stock en almacén para despachar este artículo.");
            return;
        }
        nombreArticulo = prod.nombre;
        inversionCosto = prod.costo;

        // Descontar una unidad del inventario físico en la nube
        await updateDoc(doc(db, "productos", id), { stock: prod.stock - 1 });

    } else {
        const combo = listaCombosGlobal.find(c => c.id === id);
        if (!combo) return;
        nombreArticulo = `[Kit] ${combo.nombre}`;
        inversionCosto = combo.costoCombo || 0;

        // Descontar stock de cada ingrediente del combo de forma automática
        if (combo.productosVinculados) {
            for (let item of combo.productosVinculados) {
                const pOriginal = listaProductosGlobal.find(p => p.id === item.id);
                if (pOriginal && pOriginal.stock > 0) {
                    await updateDoc(doc(db, "productos", item.id), { stock: pOriginal.stock - 1 });
                }
            }
        }
    }

    const ahora = new Date();
    const fechaFormateada = ahora.toISOString().split('T')[0] + ' ' + ahora.toTimeString().split(' ')[0];

    const esEnvioAsumido = document.querySelector('input[name="asumio-envio"]:checked').value === "si";
    const valorEnvio = esEnvioAsumido ? (parseFloat(document.getElementById("venta-envio-asumido").value) || 0) : 0;

    const payloadVenta = {
        fecha: fechaFormateada,
        articuloId: id,
        articuloTipo: tipo,
        articuloNombre: nombreArticulo,
        precioCobrado: parseFloat(inputPrecioFinal.value) || 0,
        costoInversion: inversionCosto,
        envioAsumido: valorEnvio,
        estadoPago: document.getElementById("venta-estado-pago").value
    };

    try {
        await addDoc(collection(db, "transacciones"), payloadVenta);
        alert("Operación registrada e indexada en el libro contable.");
        modalVenta.classList.replace("flex", "hidden");
        formVenta.reset();
    } catch (err) {
        alert("Error al salvar el registro de venta.");
    }
});

window.eliminarTransaccionYReversarStock = async function(idTransaccion) {
    if (!isAdmin) return;
    if (!confirm("¿Deseas anular esta venta? El stock se devolverá automáticamente a los productos correspondientes.")) return;

    try {
        const t = listaTransaccionesGlobal.find(item => item.id === idTransaccion);
        if (!t) return;

        // Reversar inventario si es producto simple
        if (t.articuloTipo === "simple") {
            const prodInventario = listaProductosGlobal.find(p => p.id === t.articuloId);
            if (prodInventario) {
                await updateDoc(doc(db, "productos", prodInventario.id), {
                    stock: prodInventario.stock + 1
                });
            }
        } 
        // Reversar inventario si era un combo unificado
        else if (t.articuloTipo === "combo") {
            const comboOriginal = listaCombosGlobal.find(c => c.id === t.articuloId);
            if (comboOriginal && comboOriginal.productosVinculados) {
                for (let item of comboOriginal.productosVinculados) {
                    const prodInventario = listaProductosGlobal.find(p => p.id === item.id);
                    if (prodInventario) {
                        await updateDoc(doc(db, "productos", prodInventario.id), {
                            stock: prodInventario.stock + 1
                        });
                    }
                }
            }
        }

        await deleteDoc(doc(db, "transacciones", idTransaccion));
        alert("Venta anulada con éxito. Balances y stock restaurados.");

    } catch (error) {
        alert("Error de conexión al anular la transacción.");
    }
};

// ==========================================
// 12. AUDITORÍA FINANCIERA Y COLCHÓN DE CAJA
// ==========================================
function iniciarEscuchaCajaFuerte() {
    onSnapshot(doc(db, "configuracion", "caja_daesmi"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            capitalBaseFijo = data.capitalBase || 0;
            retirosAcumulados = data.retiros || 0;
        } else {
            setDoc(doc(db, "configuracion", "caja_daesmi"), { capitalBase: 0, retiros: 0 });
        }
        procesarYRenderizarTodo();
    });
}

window.ajustarCapitalBaseManual = async function() {
    if (!isAdmin) return;
    const nuevoValor = prompt("Establece el monto real de tu Colchón de Caja Inicial ($):", capitalBaseFijo);
    if (nuevoValor === null) return;
    
    const valorParsed = parseFloat(nuevoValor) || 0;
    try {
        await updateDoc(doc(db, "configuracion", "caja_daesmi"), { capitalBase: valorParsed });
        alert(`Fondo operativo de caja establecido en $${valorParsed.toLocaleString()} COP.`);
    } catch (e) {
        alert("Error de permisos al modificar la caja base.");
    }
};

window.actualizarCapitalBaseDesdeAjustes = async function() {
    if (!isAdmin) return;
    const input = document.getElementById("input-ajuste-capital");
    const valor = parseFloat(input.value) || 0;

    if (valor < 0) return alert("Ingresa un monto de dinero válido.");

    try {
        await updateDoc(doc(db, "configuracion", "caja_daesmi"), { capitalBase: valor });
        alert(`¡Éxito! El Capital Base operativo se fijó en $${valor.toLocaleString()} COP.`);
        input.value = "";
    } catch (e) {
        alert("No tienes privilegios de escritura.");
    }
};

window.abrirModalRetiro = function() {
    if (!isAdmin) return alert("Solo la administradora puede ejecutar retiros personales de utilidad.");
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

    if (montoARetirar <= 0) return alert("Ingresa una suma válida mayor a cero.");

    const nuevoTotalRetiros = retirosAcumulados + montoARetirar;

    try {
        await updateDoc(doc(db, "configuracion", "caja_daesmi"), { retiros: nuevoTotalRetiros });
        alert(`Retiro de $${montoARetirar.toLocaleString()} COP registrado.\nTu Efectivo Físico en Caja ha sido recalculado.`);
        window.cerrarModalRetiro();
    } catch (e) {
        alert("Error de conexión al asentar el retiro.");
    }
};

// ==========================================
// 13. GENERADOR DE CAMPAÑAS DE MARKETING LOCAL
// ==========================================
window.detonarMarketingProducto = function(id) {
    const p = listaProductosGlobal.find(item => item.id === id);
    if (!p) return;

    document.getElementById("mkt-preview-titulo").textContent = p.nombre;
    document.getElementById("mkt-preview-desc").textContent = p.descripcion || "¡Disponible en stock!";
    document.getElementById("mkt-preview-precio").textContent = `$${p.precio.toLocaleString()} COP`;

    let copyRecomendado = `✨ *${p.nombre.toUpperCase()}* ✨\n\n`;
    if (p.descripcion) copyRecomendado += `${p.descripcion}\n\n`;
    
    if (p.variacion) {
        copyRecomendado += `🎨 Disponible en hermosos estilos/tonos: _${p.variacion.opciones.join(", ")}_\n\n`;
    }
    
    copyRecomendado += `💰 *Precio:* $${p.precio.toLocaleString()} COP\n`;
    copyRecomendado += `📍 Entregas seguras en Medellín. ¡Pide el tuyo antes de que se agote! 🛍️✨`;

    document.getElementById("mkt-texto-copy").value = copyRecomendado;
    document.getElementById("modal-marketing").classList.replace("hidden", "flex");
};

document.getElementById("btn-copiar-copy").addEventListener("click", () => {
    const cajaTexto = document.getElementById("mkt-texto-copy");
    cajaTexto.select();
    cajaTexto.setSelectionRange(0, 99999); // Soporte móvil
    navigator.clipboard.writeText(cajaTexto.value);
    alert("¡Texto comercial copiado! Ya puedes pegarlo en tus estados de WhatsApp o Instagram.");
});

// ==========================================
// 14. INICIALIZACIÓN AUTOMÁTICA
// ==========================================
iniciarEscuchasNube();
