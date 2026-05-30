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
let carritoGlobal = [];

// Variables Contables de Control
let capitalBaseGlobal = 0; 
let retirosAcumulados = 0;  
let isAdmin = false;       

// Filtros y Busbadores activos en la interfaz
let categoriaSeleccionadaGlobal = "TODOS";
let terminoBusqueda = "";

// Elementos del DOM reutilizados frecuentemente
const contenedorCatalogo = document.getElementById("contenedor-catalogo");
const contenedorCategorias = document.getElementById("contenedor-categorias");
const buscadorInput = document.getElementById("buscador-input");

const navInventario = document.getElementById("nav-inventario");
const navBalance = document.getElementById("nav-balance");
const navAjustes = document.getElementById("nav-ajustes");

const viewCatalogo = document.getElementById("view-catalogo");
const viewInventario = document.getElementById("view-inventario");
const viewBalance = document.getElementById("view-balance");
const viewAjustes = document.getElementById("view-ajustes");

// Escuchas de Navegación Inferior
navInventario.addEventListener("click", () => mostrarVista(viewInventario, navInventario));
navBalance.addEventListener("click", () => {
    if (isAdmin) mostrarVista(viewBalance, navBalance);
});
navAjustes.addEventListener("click", () => {
    if (isAdmin) mostrarVista(viewAjustes, navAjustes);
});

// Función para alternar vistas visibles en la interfaz monopágina
function mostrarVista(vistaObjetivo, botonActivo) {
    [viewCatalogo, viewInventario, viewBalance, viewAjustes].forEach(v => v.classList.add("hidden"));
    vistaObjetivo.classList.remove("hidden");

    [navInventario, navBalance, navAjustes].forEach(btn => {
        btn.classList.remove("text-purple-900", "scale-110");
        btn.classList.add("text-slate-400");
    });

    if (botonActivo) {
        botonActivo.classList.remove("text-slate-400");
        botonActivo.classList.add("text-purple-900", "scale-110");
    }
}

// Variables para controlar y apagar las escuchas en tiempo real de Firebase
let desuscribirTransacciones = null;
let desuscribirCaja = null;

// ==========================================
// ESCUCHAS DE FIREBASE REESTRUCTURADAS
// ==========================================

function iniciarEscuchasPublicas() {
    // Escucha de Productos: Abierta al público
    onSnapshot(query(collection(db, "productos"), orderBy("nombre", "asc")), (snapshot) => {
        listaProductosGlobal = [];
        snapshot.forEach(doc => {
            listaProductosGlobal.push({ id: doc.id, ...doc.data() });
        });
        renderizarCatalogoYAlertas();
        renderizarTablaInventarioAdmin();
        actualizarSelectVinculacionCombos();
    }, (error) => {
        console.error("Error en productos públicos:", error);
    });

    // Escucha de Combos: Abierta al público
    onSnapshot(collection(db, "combos"), (snapshot) => {
        listaCombosGlobal = [];
        snapshot.forEach(doc => {
            listaCombosGlobal.push({ id: doc.id, ...doc.data() });
        });
        renderizarCatalogoYAlertas();
        renderizarTablaCombosAdmin();
    }, (error) => {
        console.error("Error en combos públicos:", error);
    });
}

function iniciarEscuchasPrivadasAdmin() {
    // Apagar escuchas previas si existen para no duplicar flujos de red
    if (desuscribirTransacciones) desuscribirTransacciones();
    if (desuscribirCaja) desuscribirCaja();

    // Escucha de Transacciones (Solo Admin logueado)
    desuscribirTransacciones = onSnapshot(query(collection(db, "transacciones"), orderBy("fecha", "desc")), (snapshot) => {
        listaTransaccionesGlobal = [];
        snapshot.forEach(doc => {
            listaTransaccionesGlobal.push({ id: doc.id, ...doc.data() });
        });
        renderizarBalanceAdmin();
        renderizarHistorialVentasAdmin();
    }, (error) => {
        console.warn("Bloqueo de seguridad en transacciones:", error.message);
    });

    // Escucha de Caja Fuerte (Solo Admin logueado)
    desuscribirCaja = onSnapshot(doc(db, "configuracion", "caja_daesmi"), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            capitalBaseGlobal = data.capitalBase || 0;
            retirosAcumulados = data.retiros || 0;
            renderizarBalanceAdmin();
        }
    }, (error) => {
        console.warn("Bloqueo de seguridad en caja fuerte:", error.message);
    });
}

function monitorearSesion() {
    onAuthStateChanged(auth, (user) => {
        const btnEstado = document.getElementById("btn-estado-sesion");
        const txtEstado = document.getElementById("txt-estado-sesion");

        if (user) {
            isAdmin = true;
            txtEstado.textContent = "Admin";
            btnEstado.classList.replace("bg-purple-100", "bg-emerald-100");
            btnEstado.classList.replace("text-purple-800", "text-emerald-800");
            
            // Cuando inicias sesión con éxito, se activan los flujos de administración
            iniciarEscuchasPrivadasAdmin();
        } else {
            isAdmin = false;
            txtEstado.textContent = "Login";
            btnEstado.classList.replace("bg-emerald-100", "bg-purple-100");
            btnEstado.classList.replace("text-emerald-800", "text-purple-800");

            // Al cerrar sesión o entrar como cliente común, cancelamos las escuchas privadas de inmediato
            if (desuscribirTransacciones) { desuscribirTransacciones(); desuscribirTransacciones = null; }
            if (desuscribirCaja) { desuscribirCaja(); desuscribirCaja = null; }

            listaTransaccionesGlobal = [];
            capitalBaseGlobal = 0;
            retirosAcumulados = 0;

            mostrarVista(viewCatalogo, null);
        }
        renderizarCatalogoYAlertas();
    });
}

// ==========================================
// RENDERIZADO DEL CATÁLOGO PÚBLICO
// ==========================================

function renderizarCatalogoYAlertas() {
    contenedorCatalogo.innerHTML = "";

    // 1. COMPONENTE: SECCIÓN HIGHLIGHT / TOP 3 MÁS AMADOS
    const productosConVentas = listaProductosGlobal.filter(p => (p.ventasCount || 0) > 0);
    productosConVentas.sort((a, b) => (b.ventasCount || 0) - (a.ventasCount || 0));
    const top3 = productosConVentas.slice(0, 3);

    if (top3.length > 0 && categoriaSeleccionadaGlobal === "TODOS" && terminoBusqueda === "") {
        let topHTML = `
            <div class="col-span-full mb-2">
                <h3 class="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1 mb-2">
                    <span>✨ Los más amados por nuestras clientas</span>
                </h3>
                <div class="grid grid-cols-1 gap-2">
        `;

        top3.forEach(p => {
            const fotoValidaTop = (p.foto && p.foto !== 'undefined') ? p.foto : 'https://placehold.co/300x350/eae6f8/6b21a8?text=DAESMI';
            topHTML += `
                <div class="bg-gradient-to-r from-purple-900 to-purple-950 text-white p-2.5 rounded-2xl flex gap-3 items-center relative overflow-hidden shadow-sm">
                    <img src="${fotoValidaTop}" class="w-12 h-12 object-cover rounded-xl bg-white/10 shrink-0">
                    <div class="flex-1 min-w-0">
                        <span class="text-[7px] font-black uppercase tracking-widest bg-white/20 px-1 py-0.5 rounded-sm text-purple-200">Recomendado</span>
                        <h4 class="font-bold text-xs truncate mt-0.5">${p.nombre}</h4>
                        <p class="text-[11px] font-black text-purple-200">$${p.precio.toLocaleString()}</p>
                    </div>
                    <button type="button" onclick="window.agregarAlCarritoConVariacion('${p.id}', false)" class="bg-white text-purple-950 p-2 rounded-xl font-black text-xs cursor-pointer active:scale-95 transition-all shadow-xs shrink-0">
                        <i data-lucide=\"plus\" class=\"w-4 h-4\"></i>
                    </button>
                </div>
            `;
        });

        topHTML += `</div></div>`;
        contenedorCatalogo.insertAdjacentHTML("beforeend", topHTML);
    }

    // 2. COMPONENTE: RENDERIZADO DE COMBOS DESTACADOS
    listaCombosGlobal.forEach(c => {
        if (categoriaSeleccionadaGlobal !== "TODOS") return; 
        if (terminoBusqueda !== "" && !c.nombre.toLowerCase().includes(terminoBusqueda)) return;

        const enStockCombo = parseInt(c.stock) > 0;
        const fotoValidaCombo = (c.foto && c.foto !== 'undefined') ? c.foto : 'https://placehold.co/300x350/eae6f8/6b21a8?text=DAESMI';

        const cardCombo = `
            <div class="bg-linear-to-br from-purple-900 to-indigo-950 text-white p-3.5 rounded-3xl shadow-md flex gap-3 relative col-span-full overflow-hidden border border-purple-800 ${!enStockCombo && !isAdmin ? 'opacity-40' : ''}">
                <div class="absolute -right-6 -top-6 w-16 h-16 bg-purple-500/20 rounded-full blur-xl"></div>
                <img src="${fotoValidaCombo}" class="w-20 h-20 object-cover rounded-2xl bg-white/10 self-center shrink-0 border border-white/10">
                <div class="flex-1 flex flex-col justify-between z-10">
                    <div>
                        <div class="flex justify-between items-start">
                            <span class="text-[8px] font-black bg-pink-500 text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow-xs">Combo Ahorro 🔥</span>
                            ${isAdmin ? `<span class="text-[9px] font-bold bg-white/10 text-purple-200 px-1.5 py-0.5 rounded-md">Stock: ${c.stock}</span>` : ''}
                        </div>
                        <h4 class="font-bold text-sm leading-tight mt-1.5 text-pink-100">${c.nombre}</h4>
                        <p class="text-[10px] text-purple-200/80 line-clamp-2 mt-0.5 font-medium">${c.descripcion || ''}</p>
                    </div>
                    <div class="flex justify-between items-center mt-3">
                        <div class="flex flex-col">
                            <span class="font-black text-white text-base">$${c.precio.toLocaleString()}</span>
                            ${isAdmin ? `<span class="text-[8px] text-purple-300/70 font-bold">Costo calcul.: $${c.costo.toLocaleString()}</span>` : ''}
                        </div>
                        <div class="flex gap-1">
                            ${isAdmin ? `
                                <button type="button" onclick="window.abrirEditarCombo('${c.id}')" class="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide=\"edit\" class=\"w-3.5 h-3.5\"></i></button>
                                <button type="button" onclick="window.eliminarComboNube('${c.id}')" class="bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide=\"trash\" class=\"w-3.5 h-3.5\"></i></button>
                            ` : `
                                <button type="button" ${enStockCombo ? `onclick="window.agregarAlCarritoConVariacion('${c.id}', true)"` : 'disabled'} class="${enStockCombo ? 'bg-pink-500 hover:bg-pink-600 text-white cursor-pointer active:scale-95' : 'bg-white/10 text-white/40 cursor-not-allowed'} px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1">
                                    <i data-lucide="${enStockCombo ? 'shopping-bag' : 'slash'}" class="w-3.5 h-3.5"></i> Lo quiero
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
        contenedorCatalogo.insertAdjacentHTML("beforeend", cardCombo);
    });

    // 3. COMPONENTE: INYECTAR PRODUCTOS FÍSICOS SIMPLES
    listaProductosGlobal.forEach(p => {
        if (categoriaSeleccionadaGlobal !== "TODOS" && p.categoria.trim().toUpperCase() !== categoriaSeleccionadaGlobal) return;

        if (p.nombre.toLowerCase().includes(terminoBusqueda) || p.categoria.toLowerCase().includes(terminoBusqueda)) {
            const enStock = parseInt(p.stock) > 0;
            const fotoValida = (p.foto && p.foto !== 'undefined') ? p.foto : 'https://placehold.co/300x350/eae6f8/6b21a8?text=DAESMI';

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
                    <img src="${fotoValida}" class="w-20 h-20 object-cover rounded-2xl bg-slate-50 self-center shrink-0">
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
                                    <button type="button" onclick="window.abrirEditarProducto('${p.id}')" class="bg-slate-100 text-slate-700 p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide=\"edit\" class=\"w-3.5 h-3.5\"></i></button>
                                    <button type="button" onclick="window.eliminarProductoNube('${p.id}')" class="bg-rose-50 text-rose-600 p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide=\"trash\" class=\"w-3.5 h-3.5\"></i></button>
                                ` : `
                                    <button type="button" ${enStock ? `onclick="window.agregarAlCarritoConVariacion('${p.id}', false)"` : 'disabled'} class="${enStock ? 'bg-purple-900 text-white cursor-pointer active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'} p-1.5 rounded-xl font-bold transition-all shadow-xs">
                                        <i data-lucide="${enStock ? 'plus' : 'slash'}" class="w-4 h-4"></i>
                                    </button>
                                `}
                                ${isAdmin ? `
                                    <button type="button" onclick="window.detonarMarketingProducto('${p.id}')" class="bg-purple-100 text-purple-800 p-1.5 rounded-xl text-xs font-bold cursor-pointer"><i data-lucide=\"megaphone\" class=\"w-3.5 h-3.5\"></i></button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            contenedorCatalogo.insertAdjacentHTML("beforeend", cardProd);
        }
    });

    if (contenedorCatalogo.innerHTML === "") {
        contenedorCatalogo.innerHTML = `
            <div class="col-span-full py-12 text-center">
                <p class="text-xs font-bold text-slate-400">No encontramos productos en esta sección justo ahora.</p>
            </div>
        `;
    }

    lucide.createIcons();
}

// ==========================================
// RENDERIZADO DE LAS CATEGORÍAS (INTERFAZ)
// ==========================================

function renderizarMenuCategorias() {
    const setCategorias = new Set(["TODOS"]);
    listaProductosGlobal.forEach(p => {
        if (p.categoria) setCategorias.add(p.categoria.trim().toUpperCase());
    });

    contenedorCategorias.innerHTML = "";
    setCategorias.forEach(cat => {
        const esActivo = categoriaSeleccionadaGlobal === cat;
        const btnCat = document.createElement("button");
        btnCat.type = "button";
        btnCat.className = `px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide whitespace-nowrap transition-all cursor-pointer ${
            esActivo 
            ? "bg-purple-900 text-white shadow-xs" 
            : "bg-white text-slate-500 border border-slate-100 hover:bg-slate-50"
        }`;
        btnCat.textContent = cat;
        btnCat.addEventListener("click", () => {
            categoriaSeleccionadaGlobal = cat;
            renderizarMenuCategorias();
            renderizarCatalogoYAlertas();
        });
        contenedorCategorias.appendChild(btnCat);
    });
}

// Escucha del Buscador en tiempo real
buscadorInput.addEventListener("input", (e) => {
    terminoBusqueda = e.target.value.toLowerCase().trim();
    renderizarCatalogoYAlertas();
});

// ==========================================
// INTERFACES DEL PANEL DE ADMINISTRACIÓN (INVENTARIO)
// ==========================================

function renderizarTablaInventarioAdmin() {
    const tabla = document.getElementById("tabla-inventario-cuerpo");
    if (!tabla) return;
    tabla.innerHTML = "";

    listaProductosGlobal.forEach(p => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-100 text-slate-700 text-xs font-medium";
        tr.innerHTML = `
            <td class="p-2 font-bold text-slate-900">${p.nombre}</td>
            <td class="p-2 uppercase text-[10px] font-black text-purple-600">${p.categoria}</td>
            <td class="p-2 font-bold">$${p.precio.toLocaleString()}</td>
            <td class="p-2 text-center font-black ${parseInt(p.stock) <= 2 ? 'text-rose-600 bg-rose-50/50' : 'text-slate-600'}">${p.stock}</td>
        `;
        tabla.appendChild(tr);
    });
}

function renderizarTablaCombosAdmin() {
    const tabla = document.getElementById("tabla-combos-cuerpo");
    if (!tabla) return;
    tabla.innerHTML = "";

    listaCombosGlobal.forEach(c => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-100 text-slate-700 text-xs font-medium";
        tr.innerHTML = `
            <td class="p-2 font-bold text-purple-950">${c.nombre}</td>
            <td class="p-2 font-bold">$${c.precio.toLocaleString()}</td>
            <td class="p-2 text-center font-black">${c.stock}</td>
        `;
        tabla.appendChild(tr);
    });
}

function actualizarSelectVinculacionCombos() {
    const contenedor = document.getElementById("combo-productos-vinculados");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    if (listaProductosGlobal.length === 0) {
        contenedor.innerHTML = `<p class="text-[10px] font-bold text-slate-400">No hay productos guardados para vincular.</p>`;
        return;
    }

    listaProductosGlobal.forEach(p => {
        const div = document.createElement("div");
        div.className = "flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100";
        div.innerHTML = `
            <input type="checkbox" value="${p.id}" data-nombre="${p.nombre}" data-costo="${p.costo}" class="chk-combo-prod w-3.5 h-3.5 text-purple-600 rounded-sm focus:ring-purple-500">
            <div class="flex-1 min-w-0">
                <p class="text-[11px] font-bold text-slate-800 truncate">${p.nombre}</p>
                <p class="text-[9px] text-slate-400 font-bold">Costo: $${p.costo.toLocaleString()}</p>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

// ==========================================
// INTERFACES DEL PANEL DE ADMINISTRACIÓN (BALANCES)
// ==========================================

function renderizarBalanceAdmin() {
    if (!isAdmin) return;

    let totalVentasContadas = 0;
    let totalInversionEnBodega = 0;
    let rentabilidadBrutaTeorica = 0;

    // Calcular costos actuales invertidos en bodega física
    listaProductosGlobal.forEach(p => {
        const stk = parseInt(p.stock) || 0;
        const cst = parseFloat(p.costo) || 0;
        totalInversionEnBodega += (stk * cst);
    });

    listaCombosGlobal.forEach(c => {
        const stk = parseInt(c.stock) || 0;
        const cst = parseFloat(c.costo) || 0;
        totalInversionEnBodega += (stk * cst);
    });

    // Procesar historial transaccional real para la caja y rentabilidades
    listaTransaccionesGlobal.forEach(t => {
        const totalVenta = parseFloat(t.total) || 0;
        const costoVenta = parseFloat(t.costoTotalCalculado) || 0;

        totalVentasContadas += totalVenta;
        rentabilidadBrutaTeorica += (totalVenta - costoVenta);
    });

    // Fórmulas matemáticas de caja fuerte DAESMI
    const efectivoTeoricoEnCaja = capitalBaseGlobal + totalVentasContadas - retirosAcumulados;
    const utilidadesNetasActuales = rentabilidadBrutaTeorica - retirosAcumulados;

    // Inyección de valores calculados en las tarjetas del DOM
    document.getElementById("kpi-efectivo-caja").textContent = `$${efectivoTeoricoEnCaja.toLocaleString()} COP`;
    document.getElementById("kpi-ventas-totales").textContent = `$${totalVentasContadas.toLocaleString()} COP`;
    document.getElementById("kpi-ganancias-netas").textContent = `$${utilidadesNetasActuales.toLocaleString()} COP`;
    document.getElementById("kpi-inversion-bodega").textContent = `$${totalInversionEnBodega.toLocaleString()} COP`;
    
    // Indicador dinámico de control de salud financiera
    const kpiSalud = document.getElementById("kpi-ganancias-netas");
    if (utilidadesNetasActuales < 0) {
        kpiSalud.className = "text-xl font-black text-rose-600";
    } else {
        kpiSalud.className = "text-xl font-black text-purple-950";
    }
}

function renderizarHistorialVentasAdmin() {
    const contenedor = document.getElementById("historial-ventas-lista");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    if (listaTransaccionesGlobal.length === 0) {
        contenedor.innerHTML = `
            <div class="py-6 text-center border border-dashed border-slate-200 rounded-2xl">
                <p class="text-[11px] font-bold text-slate-400">Aún no se registran transacciones en el libro de ventas.</p>
            </div>
        `;
        return;
    }

    listaTransaccionesGlobal.forEach(t => {
        const div = document.createElement("div");
        div.className = "bg-white p-3 rounded-2xl border border-slate-100 shadow-3xs space-y-1.5 relative";
        
        let productosCompradosHTML = "";
        t.items.forEach(it => {
            productosCompradosHTML += `
                <div class="flex justify-between text-[11px] text-slate-600 font-medium">
                    <span>• ${it.nombre} ${it.variacionElegida ? `(${it.variacionElegida})` : ''} <b class="text-slate-400">x${it.cantidad}</b></span>
                    <span class="font-bold text-slate-800">$${(it.precio * it.cantidad).toLocaleString()}</span>
                </div>
            `;
        });

        const utilVenta = t.total - (t.costoTotalCalculado || 0);

        div.innerHTML = `
            <div class="flex justify-between items-center border-b border-slate-50 pb-1.5">
                <span class="text-[10px] font-black text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md">${t.metodoPago.toUpperCase()}</span>
                <span class="text-[9px] font-bold text-slate-400">${t.fecha.split("T")[0]}</span>
            </div>
            <div class="space-y-0.5">${productosCompradosHTML}</div>
            <div class="flex justify-between items-center pt-1.5 border-t border-slate-50 text-xs font-black">
                <span class="text-slate-800">Total Recibido:</span>
                <span class="text-purple-950 text-sm">$${t.total.toLocaleString()}</span>
            </div>
            <div class="flex justify-between items-center text-[9px] font-bold text-slate-400 bg-slate-50/80 p-1 rounded-lg">
                <span>Margen Ganancia: +$${utilVenta.toLocaleString()}</span>
                <button onclick="window.eliminarVentaNube('${t.id}')" class="text-rose-500 hover:text-rose-700 font-black cursor-pointer uppercase text-[8px]">Reversar Venta</button>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

// ==========================================
// SISTEMA LOGÍSTICO Y LOGICA INTERNA DEL CARRITO
// ==========================================

window.agregarAlCarritoConVariacion = function(id, esCombo = false) {
    if (esCombo) {
        const combo = listaCombosGlobal.find(c => c.id === id);
        if (!combo) return;

        const itemExistente = carritoGlobal.find(it => it.id === id && it.esCombo === true);
        if (itemExistente) {
            itemExistente.cantidad++;
        } else {
            carritoGlobal.push({
                id: combo.id,
                nombre: combo.nombre,
                precio: parseFloat(combo.precio),
                costo: parseFloat(combo.costo) || 0,
                esCombo: true,
                variacionElegida: null,
                cantidad: 1,
                productosVinculados: combo.productosVinculados || []
            });
        }
    } else {
        const p = listaProductosGlobal.find(item => item.id === id);
        if (!p) return;

        let variacionSeleccionada = null;
        const selector = document.getElementById(`select-variant-${id}`);
        if (selector) {
            variacionSeleccionada = selector.value;
        }

        const itemExistente = carritoGlobal.find(it => 
            it.id === id && 
            it.esCombo === false && 
            it.variacionElegida === variacionSeleccionada
        );

        if (itemExistente) {
            itemExistente.cantidad++;
        } else {
            carritoGlobal.push({
                id: p.id,
                nombre: p.nombre,
                precio: parseFloat(p.precio),
                costo: parseFloat(p.costo),
                esCombo: false,
                variacionElegida: variacionSeleccionada,
                cantidad: 1
            });
        }
    }

    renderizarCarritoInterfaz();
};

function renderizarCarritoInterfaz() {
    const contenedor = document.getElementById("carrito-items-lista");
    const countBurbuja = document.getElementById("carrito-count-burbuja");
    const labelTotal = document.getElementById("carrito-total-monto");

    contenedor.innerHTML = "";
    let totalMonto = 0;
    let totalItemsUnidades = 0;

    carritoGlobal.forEach((item, index) => {
        totalMonto += (item.precio * item.cantidad);
        totalItemsUnidades += item.cantidad;

        const div = document.createElement("div");
        div.className = "flex justify-between items-center bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs font-bold text-slate-800";
        div.innerHTML = `
            <div class="min-w-0 flex-1">
                <p class="truncate text-slate-900">${item.nombre}</p>
                <p class="text-[9px] text-purple-600 font-black uppercase tracking-wider">${item.esCombo ? 'Combo Especial' : (item.variacionElegida || 'Estilo Estándar')}</p>
                <p class="text-[10px] text-slate-400 font-bold mt-0.5">$${item.precio.toLocaleString()} c/u</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <div class="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <button type="button" onclick="window.alterarCantidadCarrito(${index}, -1)" class="px-2 py-1 text-slate-500 font-black hover:bg-slate-50 cursor-pointer text-xs">-</button>
                    <span class="px-1.5 text-purple-950 font-black text-xs">${item.cantidad}</span>
                    <button type="button" onclick="window.alterarCantidadCarrito(${index}, 1)" class="px-2 py-1 text-slate-500 font-black hover:bg-slate-50 cursor-pointer text-xs">+</button>
                </div>
                <button type="button" onclick="window.eliminarItemCarrito(${index})" class="text-rose-500 font-bold text-xs p-1 cursor-pointer">✕</button>
            </div>
        `;
        contenedor.appendChild(div);
    });

    countBurbuja.textContent = totalItemsUnidades;
    labelTotal.textContent = `$${totalMonto.toLocaleString()}`;

    const widget = document.getElementById("carrito-widget-flotante");
    if (totalItemsUnidades > 0) {
        widget.classList.replace("translate-y-32", "translate-y-0");
        widget.classList.replace("opacity-0", "opacity-100");
    } else {
        widget.classList.replace("translate-y-0", "translate-y-32");
        widget.classList.replace("opacity-100", "opacity-0");
        window.cerrarModalCarrito();
    }
}

window.alterarCantidadCarrito = function(index, delta) {
    carritoGlobal[index].cantidad += delta;
    if (carritoGlobal[index].cantidad <= 0) {
        carritoGlobal.splice(index, 1);
    }
    renderizarCarritoInterfaz();
};

window.eliminarItemCarrito = function(index) {
    carritoGlobal.splice(index, 1);
    renderizarCarritoInterfaz();
};

window.abrirModalCarrito = function() {
    if (carritoGlobal.length === 0) return;
    document.getElementById("modal-carrito").classList.replace("hidden", "flex");
};

window.cerrarModalCarrito = function() {
    document.getElementById("modal-carrito").classList.replace("flex", "hidden");
};

// ==========================================
// GUARDAR VENTAS Y ACTUALIZACIÓN LOGÍSTICA DE STOCK
// ==========================================

window.procesarDespachoVenta = async function() {
    if (carritoGlobal.length === 0) return;

    const metodoPago = document.getElementById("carrito-metodo-pago").value;
    let totalFacturado = 0;
    let costoTotalCalculado = 0;

    // Verificar stock físico de forma restrictiva antes de alterar la nube
    for (const item of carritoGlobal) {
        totalFacturado += (item.precio * item.cantidad);
        costoTotalCalculado += (item.costo * item.cantidad);

        if (item.esCombo) {
            const comboReal = listaCombosGlobal.find(c => c.id === item.id);
            if (!comboReal || parseInt(comboReal.stock) < item.cantidad) {
                return alert(`Lo sentimos, el combo "${item.nombre}" ya no cuenta con suficiente stock disponible.`);
            }
        } else {
            const prodReal = listaProductosGlobal.find(p => p.id === item.id);
            if (!prodReal || parseInt(prodReal.stock) < item.cantidad) {
                return alert(`Lo sentimos, el producto "${item.nombre}" ya no cuenta con suficiente stock disponible.`);
            }
        }
    }

    try {
        // 1. Guardar la venta en la colección transaccional
        await addDoc(collection(db, "transacciones"), {
            items: carritoGlobal.map(it => ({
                id: it.id,
                nombre: it.nombre,
                precio: it.precio,
                costo: it.costo,
                cantidad: it.cantidad,
                esCombo: it.esCombo,
                variacionElegida: it.variacionElegida
            })),
            total: totalFacturado,
            costoTotalCalculado: costoTotalCalculado,
            metodoPago: metodoPago,
            fecha: new Date().toISOString()
        });

        // 2. Descontar las unidades de stock físico correspondientes en Firebase
        for (const item of carritoGlobal) {
            if (item.esCombo) {
                // Descontar stock del combo macro
                const comboReal = listaCombosGlobal.find(c => c.id === item.id);
                const nuevoStockCombo = Math.max(0, parseInt(comboReal.stock) - item.cantidad);
                await updateDoc(doc(db, "combos", item.id), { stock: nuevoStockCombo });

                // Descontar opcionalmente cada producto interno que compone el combo
                if (item.productosVinculados && item.productosVinculados.length > 0) {
                    for (const pVinculado of item.productosVinculados) {
                        const prodInterno = listaProductosGlobal.find(p => p.id === pVinculado.id);
                        if (prodInterno) {
                            const nuevoStockInterno = Math.max(0, parseInt(prodInterno.stock) - item.cantidad);
                            await updateDoc(doc(db, "productos", pVinculado.id), { stock: nuevoStockInterno });
                        }
                    }
                }
            } else {
                // Descontar stock de producto individual tradicional
                const prodReal = listaProductosGlobal.find(p => p.id === item.id);
                const nuevoStock = Math.max(0, parseInt(prodReal.stock) - item.cantidad);
                const nuevasVentasCount = (parseInt(prodReal.ventasCount) || 0) + item.cantidad;

                await updateDoc(doc(db, "productos", item.id), { 
                    stock: nuevoStock,
                    ventasCount: nuevasVentasCount
                });
            }
        }

        alert("🛒 ¡Tu pedido ha sido registrado con éxito!");
        carritoGlobal = [];
        renderizarCarritoInterfaz();
        window.cerrarModalCarrito();

    } catch (err) {
        console.error(err);
        alert("Ocurrió un inconveniente al procesar tu compra externa.");
    }
};

// ==========================================
// CONTROL DE FORMULARIOS Y MODALES OPERATIVOS (CRUD ADMIN)
// ==========================================

// Modales de Productos Simples
window.abrirModalNuevoProducto = function() {
    if (!isAdmin) return;
    document.getElementById("form-producto-id").value = "";
    document.getElementById("form-producto-titulo").textContent = "Nuevo Producto Físico";
    document.getElementById("form-producto-nombre").value = "";
    document.getElementById("form-producto-categoria").value = "";
    document.getElementById("form-producto-precio").value = "";
    document.getElementById("form-producto-costo").value = "";
    document.getElementById("form-producto-stock").value = "";
    document.getElementById("form-producto-foto").value = "";
    document.getElementById("form-producto-desc").value = "";
    document.getElementById("form-producto-variacion-titulo").value = "";
    document.getElementById("form-producto-variacion-opciones").value = "";
    document.getElementById("modal-producto").classList.replace("hidden", "flex");
};

window.abrirEditarProducto = function(id) {
    if (!isAdmin) return;
    const p = listaProductosGlobal.find(item => item.id === id);
    if (!p) return;

    document.getElementById("form-producto-id").value = p.id;
    document.getElementById("form-producto-titulo").textContent = "Modificar Atributos";
    document.getElementById("form-producto-nombre").value = p.nombre;
    document.getElementById("form-producto-categoria").value = p.categoria;
    document.getElementById("form-producto-precio").value = p.precio;
    document.getElementById("form-producto-costo").value = p.costo || 0;
    document.getElementById("form-producto-stock").value = p.stock;
    document.getElementById("form-producto-foto").value = p.foto || "";
    document.getElementById("form-producto-desc").value = p.descripcion || "";
    
    if (p.variacion) {
        document.getElementById("form-producto-variacion-titulo").value = p.variacion.titulo || "";
        document.getElementById("form-producto-variacion-opciones").value = p.variacion.opciones ? p.variacion.opciones.join(", ") : "";
    } else {
        document.getElementById("form-producto-variacion-titulo").value = "";
        document.getElementById("form-producto-variacion-opciones").value = "";
    }

    document.getElementById("modal-producto").classList.replace("hidden", "flex");
};

window.cerrarModalProducto = function() {
    document.getElementById("modal-producto").classList.replace("flex", "hidden");
};

window.guardarProductoNube = async function() {
    if (!isAdmin) return;

    const id = document.getElementById("form-producto-id").value;
    const nombre = document.getElementById("form-producto-nombre").value.trim();
    const categoria = document.getElementById("form-producto-categoria").value.trim().toUpperCase();
    const precio = parseFloat(document.getElementById("form-producto-precio").value) || 0;
    const costo = parseFloat(document.getElementById("form-producto-costo").value) || 0;
    const stock = parseInt(document.getElementById("form-producto-stock").value) || 0;
    const foto = document.getElementById("form-producto-foto").value.trim();
    const descripcion = document.getElementById("form-producto-desc").value.trim();
    
    const vTitulo = document.getElementById("form-producto-variacion-titulo").value.trim();
    const vOpcionesRaw = document.getElementById("form-producto-variacion-opciones").value.trim();

    if (!nombre || !categoria) return alert("Completa el nombre y su respectiva categoría.");

    let variacionObj = null;
    if (vTitulo && vOpcionesRaw) {
        variacionObj = {
            titulo: vTitulo,
            opciones: vOpcionesRaw.split(",").map(opt => opt.trim()).filter(opt => opt !== "")
        };
    }

    const payload = {
        nombre, categoria, precio, costo, stock, foto, descripcion,
        variacion: variacionObj
    };

    try {
        if (id) {
            await updateDoc(doc(db, "productos", id), payload);
        } else {
            payload.ventasCount = 0;
            await addDoc(collection(db, "productos"), payload);
        }
        window.cerrarModalProducto();
    } catch (e) {
        alert("Ocurrieron problemas de red al salvar el producto.");
    }
};

window.eliminarProductoNube = async function(id) {
    if (!isAdmin) return;
    if (confirm("¿Estás completamente segura de remover este cosmético de la base de datos?")) {
        await deleteDoc(doc(db, "productos", id));
    }
};

// Modales de Combos Promocionales
window.abrirModalNuevoCombo = function() {
    if (!isAdmin) return;
    document.getElementById("form-combo-id").value = "";
    document.getElementById("form-combo-titulo").textContent = "Crear Combo Especial";
    document.getElementById("form-combo-nombre").value = "";
    document.getElementById("form-combo-precio").value = "";
    document.getElementById("form-combo-stock").value = "";
    document.getElementById("form-combo-foto").value = "";
    document.getElementById("form-combo-desc").value = "";
    
    actualizarSelectVinculacionCombos();
    document.getElementById("modal-combo").classList.replace("hidden", "flex");
};

window.abrirEditarCombo = function(id) {
    if (!isAdmin) return;
    const c = listaCombosGlobal.find(item => item.id === id);
    if (!c) return;

    document.getElementById("form-combo-id").value = c.id;
    document.getElementById("form-combo-titulo").textContent = "Ajustar Parámetros de Combo";
    document.getElementById("form-combo-nombre").value = c.nombre;
    document.getElementById("form-combo-precio").value = c.precio;
    document.getElementById("form-combo-stock").value = c.stock;
    document.getElementById("form-combo-foto").value = c.foto || "";
    document.getElementById("form-combo-desc").value = c.descripcion || "";

    actualizarSelectVinculacionCombos();

    if (c.productosVinculados) {
        const checkboxes = document.querySelectorAll(".chk-combo-prod");
        checkboxes.forEach(chk => {
            const vinculacionExistente = c.productosVinculados.some(v => v.id === chk.value);
            if (vinculacionExistente) chk.checked = true;
        });
    }

    document.getElementById("modal-combo").classList.replace("hidden", "flex");
};

window.cerrarModalCombo = function() {
    document.getElementById("modal-combo").classList.replace("flex", "hidden");
};

window.guardarComboNube = async function() {
    if (!isAdmin) return;

    const id = document.getElementById("form-combo-id").value;
    const nombre = document.getElementById("form-combo-nombre").value.trim();
    const precio = parseFloat(document.getElementById("form-combo-precio").value) || 0;
    const stock = parseInt(document.getElementById("form-combo-stock").value) || 0;
    const foto = document.getElementById("form-combo-foto").value.trim();
    const descripcion = document.getElementById("form-combo-desc").value.trim();

    const checkboxes = document.querySelectorAll(".chk-combo-prod:checked");
    let productosVinculados = [];
    let costoAcumuladoCombo = 0;

    checkboxes.forEach(chk => {
        const cstIndividual = parseFloat(chk.dataset.costo) || 0;
        costoAcumuladoCombo += cstIndividual;
        productosVinculados.push({
            id: chk.value,
            nombre: chk.dataset.nombre
        });
    });

    if (!nombre) return alert("El combo requiere obligatoriamente una descripción nominal.");

    const payload = {
        nombre, precio, stock, foto, descripcion, productosVinculados,
        costo: costoAcumuladoCombo
    };

    try {
        if (id) {
            await updateDoc(doc(db, "combos", id), payload);
        } else {
            await addDoc(collection(db, "combos"), payload);
        }
        window.cerrarModalCombo();
    } catch (e) {
        alert("Fallas en los permisos de escritura del combo.");
    }
};

window.eliminarComboNube = async function(id) {
    if (!isAdmin) return;
    if (confirm("¿Deseas desarmar e inactivar este combo promocional?")) {
        await deleteDoc(doc(db, "combos", id));
    }
};

// Reversar Transacciones/Ventas
window.eliminarVentaNube = async function(id) {
    if (!isAdmin) return;
    if (!confirm("⚠️ ¿Estás segura de reversar esta transacción? El stock devuelto se sumará de nuevo al inventario.")) return;

    const ventaObj = listaTransaccionesGlobal.find(t => t.id === id);
    if (!ventaObj) return;

    try {
        for (const item of ventaObj.items) {
            if (item.esCombo) {
                const comboReal = listaCombosGlobal.find(c => c.id === item.id);
                if (comboReal) {
                    const nuevoStockCombo = (parseInt(comboReal.stock) || 0) + item.cantidad;
                    await updateDoc(doc(db, "combos", item.id), { stock: nuevoStockCombo });
                }
            } else {
                const prodReal = listaProductosGlobal.find(p => p.id === item.id);
                if (prodReal) {
                    const nuevoStock = (parseInt(prodReal.stock) || 0) + item.cantidad;
                    const nuevasVentasCount = Math.max(0, (parseInt(prodReal.ventasCount) || 0) - item.cantidad);
                    await updateDoc(doc(db, "productos", item.id), { 
                        stock: nuevoStock,
                        ventasCount: nuevasVentasCount
                    });
                }
            }
        }

        await deleteDoc(doc(db, "transacciones", id));
        alert("Venta reversada con éxito. Inventario restaurado.");
    } catch (e) {
        alert("Error al intentar revertir la transacción.");
    }
};

// ==========================================
// CONTROLES DE SEGURIDAD, ACCESO Y FINANZAS
// ==========================================

// Modales y ejecución de Login/Logout
const btnEstadoSesion = document.getElementById("btn-estado-sesion");
btnEstadoSesion.addEventListener("click", () => {
    if (isAdmin) {
        if (confirm("¿Cerrar sesión administrativa actual?")) {
            signOut(auth);
        }
    } else {
        document.getElementById("login-email").value = "";
        document.getElementById("login-password").value = "";
        document.getElementById("modal-login").classList.replace("hidden", "flex");
    }
});

window.cerrarModalLogin = function() {
    document.getElementById("modal-login").classList.replace("flex", "hidden");
};

window.ejecutarLoginAdmin = async function() {
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value.trim();

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.cerrarModalLogin();
    } catch (err) {
        alert("Credenciales de acceso inválidas.");
    }
};

// Configuración de Capital Base Operativo
window.guardarCapitalBaseCaja = async function() {
    if (!isAdmin) return;
    const input = document.getElementById("ajuste-capital-base");
    const valor = parseFloat(input.value) || 0;

    if (valor <= 0) return alert("Ingresa un valor operacional válido.");

    try {
        await setDoc(doc(db, "configuracion", "caja_daesmi"), { capitalBase: valor }, { merge: true });
        alert(`¡Éxito! El Capital Base operativo se fijó en $${valor.toLocaleString()} COP.`);
        input.value = "";
    } catch (e) {
        alert("No tienes permisos suficientes para alterar los registros.");
    }
};

// Control de ventanas emergentes para Retiro de Utilidades
window.abrirModalRetiro = function() {
    if (!isAdmin) return alert("Solo el administrador puede retirar dinero de las utilidades.");
    document.getElementById("retiro-monto").value = "";
    document.getElementById("modal-retiro-ganancias").classList.replace("hidden", "flex");
};

window.cerrarModalRetiro = function() {
    document.getElementById("modal-retiro-ganancias").classList.replace("flex", "hidden");
};

// Procesar y guardar el retiro acumulado en la nube
window.ejecutarRetiroGanancias = async function() {
    if (!isAdmin) return;
    const montoInput = document.getElementById("retiro-monto");
    const montoARetirar = parseFloat(montoInput.value) || 0;

    if (montoARetirar <= 0) return alert("Ingresa un monto válido mayor a cero.");

    // Sumamos el nuevo retiro al acumulado histórico en Firebase
    const nuevoTotalRetiros = retirosAcumulados + montoARetirar;

    try {
        await setDoc(doc(db, "configuracion", "caja_daesmi"), { retiros: nuevoTotalRetiros }, { merge: true });
        alert(`Retiro exitoso de $${montoARetirar.toLocaleString()} COP registrado.\nTu Efectivo Total en Caja se ha recalculado.`);
        window.cerrarModalRetiro();
    } catch (e) {
        alert("Error de red al procesar el débito en la nube.");
    }
};

// ==========================================
// HERRAMIENTA AUTOMATIZADA DE MARKETING DIGITAL
// ==========================================

window.detonarMarketingProducto = function(id) {
    if (!isAdmin) return;
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

    navigator.clipboard.writeText(cajaTexto.value)
        .then(() => alert("📋 ¡Texto publicitario copiado al portapapeles! Listo para pegar en WhatsApp o Instagram."))
        .catch(() => alert("No se otorgaron permisos de portapapeles en el navegador. Copia el recuadro manualmente."));
});

// ==========================================
// INICIALIZACIÓN DE CARGA PREVIA DEL CORE
// ==========================================

iniciarEscuchasPublicas();
monitorearSesion();
renderizarMenuCategorias();
