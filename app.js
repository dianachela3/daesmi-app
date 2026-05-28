import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración de Firebase (Tu configuración actual de DAESMI)
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "daesmi-XXXXX.firebaseapp.com",
    projectId: "daesmi-XXXXX",
    storageBucket: "daesmi-XXXXX.appspot.com",
    messagingSenderId: "XXXXXXXXXXXX",
    appId: "X:XXXXXX:web:XXXXXX"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado Global de la Aplicación
let productos = [];
let combos = [];
let transacciones = [];
let idElementoEdicion = null; // Controla si creamos o editamos
let productosEnComboTemporal = [];
let filtroFechaActual = "mes"; // Filtro por defecto para el Balance: hoy, semana, mes

// Al arrancar la página
document.addEventListener("DOMContentLoaded", () => {
    inicializarNavegacionYModales();
    escucharDatosFirebase();
    configurarSelectoresFiltro();
});

// 1. ESCUCHA DE DATOS EN TIEMPO REAL (FIREBASE)
function escucharDatosFirebase() {
    // Escuchar Productos
    onSnapshot(query(collection(db, "productos"), orderBy("nombre")), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarSelectoresDeProductos();
        renderizarTablaInventario();
        verificarAlertasStock();
    });

    // Escuchar Combos / Kits
    onSnapshot(query(collection(db, "combos"), orderBy("nombre")), (snapshot) => {
        combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarSelectoresDeProductos();
        renderizarTablaInventario();
    });

    // Escuchar Ventas y Transacciones
    onSnapshot(query(collection(db, "transacciones"), orderBy("timestamp", "desc")), (snapshot) => {
        transacciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        procesarYRenderizarBalance();
    });
}

// 2. CONEXIÓN DE NAVEGACIÓN, ENTRADAS Y FORMULARIOS
function inicializarNavegacionYModales() {
    const btnBalance = document.getElementById("nav-balance");
    const btnInventario = document.getElementById("nav-inventario");
    const btnAjustes = document.getElementById("nav-ajustes");
    const botones = [btnBalance, btnInventario, btnAjustes];

    window.cambiarVistaEfectiva = function(vistaActivaId, bActivo) {
        document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
        document.getElementById(vistaActivaId).classList.remove("hidden");
        botones.forEach(b => { 
            if(b) {
                b.classList.replace("text-purple-800", "text-slate-400"); 
                b.classList.remove("font-bold"); 
            }
        });
        if(bActivo) { 
            bActivo.classList.replace("text-slate-400", "text-purple-800"); 
            bActivo.classList.add("font-bold"); 
        }
    };

    if(btnBalance) btnBalance.addEventListener("click", () => cambiarVistaEfectiva("view-balance", btnBalance));
    if(btnInventario) btnInventario.addEventListener("click", () => cambiarVistaEfectiva("view-inventario", btnInventario));
    if(btnAjustes) btnAjustes.addEventListener("click", () => cambiarVistaEfectiva("view-ajustes", btnAjustes));

    // Botones rápidos de la Caja Dinámica
    const btnDashVenta = document.getElementById("btn-dash-venta");
    const btnDashCombo = document.getElementById("btn-dash-combo");
    if(btnDashVenta) btnDashVenta.addEventListener("click", () => abrirModalVenta());
    if(btnDashCombo) btnDashCombo.addEventListener("click", () => abrirModalCombo()); // Abre combo vacío

    // Botones del Catálogo (Pestaña Inventario)
    const btnNuevoProd = document.getElementById("btn-nuevo-producto");
    const btnNuevoCombo = document.getElementById("btn-nuevo-combo");
    if(btnNuevoProd) btnNuevoProd.addEventListener("click", () => abrirModalProducto(null)); // null asegura que limpia
    if(btnNuevoCombo) btnNuevoCombo.addEventListener("click", () => abrirModalCombo(null));

    // Cierres de Modales con métodos seguros remove/add
    document.getElementById("btn-cerrar-modal-prod").addEventListener("click", () => cerrarModal("modal-producto"));
    document.getElementById("btn-cerrar-modal-combo").addEventListener("click", () => cerrarModal("modal-combo"));
    document.getElementById("btn-cerrar-modal-venta").addEventListener("click", () => cerrarModal("modal-venta"));

    // Guardar o Editar un Producto
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

    // Guardar o Editar un Kit / Combo
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

    // Añadir producto al armador de combos
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

    // Registrar una Nueva Venta (Resta del Stock automáticamente)
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
            if (!prod || prod.stock < 1) return alert("¡Alerta! No quedan existencias suficientes de este producto.");
            
            await updateDoc(doc(db, "productos", cleanId), { stock: prod.stock - 1 });
            costoTotalVenta = prod.costo;
            nombreArticulo = prod.nombre;
        } else {
            const cleanId = itemId.replace("combo_", "");
            const combo = combos.find(c => c.id === cleanId);
            if (!combo) return;

            // Verificar stock de todos los componentes antes de descontar
            for (let item of combo.productos) {
                const orig = productos.find(p => p.id === item.id);
                if (!orig || orig.stock < item.cantidad) return alert(`Stock insuficiente en inventario para el componente: ${item.nombre}`);
            }
            // Descontar stock de los componentes del combo
            for (let item of combo.productos) {
                const orig = productos.find(p => p.id === item.id);
                await updateDoc(doc(db, "productos", item.id), { stock: orig.stock - item.cantidad });
            }
            costoTotalVenta = combo.costoTotal;
            nombreArticulo = `[Kit] ${combo.nombre}`;
        }

        // Guardar la venta con timestamp para poder filtrarla por fechas
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

    // Auto-completar precio sugerido al seleccionar artículo en venta
    document.getElementById("venta-select-item").addEventListener("change", (e) => {
        const val = e.target.value;
        let precio = 0;
        if (val.startsWith("prod_")) precio = productos.find(p => p.id === val.replace("prod_", ""))?.precio || 0;
        if (val.startsWith("combo_")) precio = combos.find(c => c.id === val.replace("combo_", ""))?.precioVenta || 0;
        document.getElementById("venta-precio-final").value = precio;
    });

    // Botón rápido de copiar texto de Marketing
    const btnCopy = document.getElementById("btn-copiar-copy");
    if(btnCopy) {
        btnCopy.addEventListener("click", () => {
            const tx = document.getElementById("mkt-texto-copy");
            tx.select();
            document.execCommand("copy");
            alert("¡Texto comercial copiado al portapapeles! 📋");
        });
    }
}

// 3. APERTURA Y CIERRE SEGURO DE MODALES (CORREGIDO)
window.abrirModalProducto = function(id = null) {
    idElementoEdicion = id; // Si es null, Firebase sabe que es nuevo producto
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
    modal.classList.remove("hidden");
    modal.classList.add("flex");
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
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function abrirModalVenta() {
    document.getElementById("form-venta").reset();
    const modal = document.getElementById("modal-venta");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function cerrarModal(idModal) {
    const modal = document.getElementById(idModal);
    modal.classList.remove("flex");
    modal.classList.add("hidden");
    idElementoEdicion = null; // Reseteo de seguridad al cerrar
}

// 4. FILTROS DE FECHAS PARA EL BALANCE (NUEVO)
function configurarSelectoresFiltro() {
    // Si tienes botones con ID: filtro-hoy, filtro-semana, filtro-mes en tu HTML
    const btnHoy = document.getElementById("filtro-hoy");
    const btnSemana = document.getElementById("filtro-semana");
    const btnMes = document.getElementById("filtro-mes");

    const cambiarFiltroVisual = (filtro, btnActivo) => {
        filtroFechaActual = filtro;
        [btnHoy, btnSemana, btnMes].forEach(b => {
            if(b) b.classList.replace("bg-purple-600", "bg-slate-200");
            if(b) b.classList.replace("text-white", "text-slate-700");
        });
        if(btnActivo) {
            btnActivo.classList.replace("bg-slate-200", "bg-purple-600");
            btnActivo.classList.replace("text-slate-700", "text-white");
        }
        procesarYRenderizarBalance(); // Recalcula la caja
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
        const haceUnaSemana = Date.now() - (7 * 24 * 60 * 60 * 1000);
        return timestamp >= haceUnaSemana;
    } else if (filtroFechaActual === "mes") {
        return ahora.getMonth() === fechaTransaccion.getMonth() && ahora.getFullYear() === fechaTransaccion.getFullYear();
    }
    return true;
}

// 5. CÁLCULO DE INGRESOS, COSTOS Y UTILIDAD EN PANTALLA
function procesarYRenderizarBalance() {
    let totalVentas = 0;
    let totalCostos = 0;
    let totalGanancias = 0;

    const tablaVentasBody = document.getElementById("lista-transacciones-body");
    if(tablaVentasBody) tablaVentasBody.innerHTML = "";

    // Filtrar transacciones según rango elegido
    const transaccionesFiltradas = transacciones.filter(t => cumpleFiltroFecha(t.timestamp));

    transaccionesFiltradas.forEach(t => {
        totalVentas += t.totalRecibido;
        totalCostos += t.costoReal;
        totalGanancias += t.gananciaLimpia;

        if(tablaVentasBody) {
            const tr = document.createElement("tr");
            tr.className = "border-b border-slate-100 text-sm";
            tr.innerHTML = `
                <td class="py-3 font-medium text-slate-800">${t.articulo}</td>
                <td class="py-3 text-slate-500">${t.fecha}</td>
                <td class="py-3 text-right font-semibold text-emerald-600">$${t.totalRecibido.toLocaleString()}</td>
                <td class="py-3 text-right"><span class="px-2 py-0.5 rounded text-xs ${t.estado === 'Pagado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${t.estado}</span></td>
            `;
            tablaVentasBody.appendChild(tr);
        }
    });

    // Actualizar las tarjetas del dashboard superior
    if(document.getElementById("dash-ingresos")) document.getElementById("dash-ingresos").innerText = `$${totalVentas.toLocaleString()}`;
    if(document.getElementById("dash-costos")) document.getElementById("dash-costos").innerText = `$${totalCostos.toLocaleString()}`;
    if(document.getElementById("dash-ganancias")) document.getElementById("dash-ganancias").innerText = `$${totalGanancias.toLocaleString()}`;
    
    // Calcular el TOP 3 de más vendidos en el rango de fechas actual
    calcularTopProductos(transaccionesFiltradas);
}

// 6. DETECCIÓN DE PRODUCTOS POPULARES (TOP 3)
function calcularTopProductos(listaTransacciones) {
    const conteo = {};
    listaTransacciones.forEach(t => {
        conteo[t.articulo] = (conteo[t.articulo] || 0) + 1;
    });

    const ordenados = Object.keys(conteo).map(name => ({
        nombre: name,
        ventas: conteo[name]
    })).sort((a, b) => b.ventas - a.ventas).slice(0, 3);

    const contenedorTop = document.getElementById("lista-top-productos");
    if(contenedorTop) {
        contenedorTop.innerHTML = "";
        if(ordenados.length === 0) {
            contenedorTop.innerHTML = `<p class="text-xs text-slate-400 italic">No hay registros en este periodo.</p>`;
            return;
        }
        ordenados.forEach((item, index) => {
            const div = document.createElement("div");
            div.className = "flex justify-between items-center text-sm py-1 border-b border-dashed border-slate-100";
            div.innerHTML = `
                <span class="text-slate-700 font-medium">${index + 1}. ${item.nombre}</span>
                <span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">${item.ventas} u.</span>
            `;
            contenedorTop.appendChild(div);
        });
    }
}

// 7. ALERTAS DE STOCK BAJO (< 3 UNIDADES)
function verificarAlertasStock() {
    const contenedorAlertas = document.getElementById("contenedor-alertas-stock");
    if (!contenedorAlertas) return;
    contenedorAlertas.innerHTML = "";

    const criticos = productos.filter(p => p.stock <= 3);

    if (criticos.length === 0) {
        contenedorAlertas.innerHTML = `
            <div class="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                <span>✅ ¡Excelente! Todo tu inventario cuenta con buen stock.</span>
            </div>
        `;
        return;
    }

    criticos.forEach(p => {
        const alerta = document.createElement("div");
        alerta.className = `p-2 mb-2 rounded-lg text-xs flex justify-between items-center ${p.stock === 0 ? 'bg-red-50 text-red-900 border-l-4 border-red-500' : 'bg-amber-50 text-amber-900 border-l-4 border-amber-500'}`;
        alerta.innerHTML = `
            <span>⚠️ <strong>${p.nombre}</strong> - Quedan solo ${p.stock} unidades.</span>
            <button onclick="abrirModalProducto('${p.id}')" class="underline font-semibold hover:text-purple-700">Surtir</button>
        `;
        contenedorAlertas.appendChild(alerta);
    });
}

// 8. FUNCIONES AUXILIARES DE RENDERIZADO VISUAL
function actualizarSelectoresDeProductos() {
    const selectCombo = document.getElementById("combo-select-producto");
    const selectVenta = document.getElementById("venta-select-item");

    if (selectCombo) {
        selectCombo.innerHTML = `<option value="">-- Seleccionar Cosmético --</option>`;
        productos.forEach(p => {
            selectCombo.innerHTML += `<option value="${p.id}">${p.nombre} (Cost: $${p.costo.toLocaleString()})</option>`;
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
        const li = document.createElement("li");
        li.className = "flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100";
        li.innerHTML = `
            <span>${p.nombre} (x${p.cantidad})</span>
            <button type="button" class="text-red-500 hover:text-red-700 font-bold" onclick="quitarItemComboTemporal(${index})">Eliminar</button>
        `;
        lista.appendChild(li);
    });

    const infoCosto = document.getElementById("combo-costo-calculado");
    if(infoCosto) infoCosto.innerText = `Costo base de este Kit: $${costoAcumulado.toLocaleString()}`;
}

window.quitarItemComboTemporal = function(index) {
    productosEnComboTemporal.splice(index, 1);
    actualizarListaVisualCombo();
}

function renderizarTablaInventario() {
    const tablaBody = document.getElementById("tabla-inventario-body");
    if(!tablaBody) return;
    tablaBody.innerHTML = "";

    // Renderizar Productos Simples
    productos.forEach(p => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-100 hover:bg-slate-50/50 text-sm";
        tr.innerHTML = `
            <td class="py-3 px-2 font-medium text-slate-800">${p.nombre}</td>
            <td class="py-3 px-2 text-slate-400 text-xs hidden md:table-cell">${p.descripcion || '-'}</td>
            <td class="py-3 px-2 text-slate-600">$${p.costo.toLocaleString()}</td>
            <td class="py-3 px-2 font-semibold text-purple-700">$${p.precio.toLocaleString()}</td>
            <td class="py-3 px-2"><span class="font-bold ${p.stock <= 3 ? 'text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded' : 'text-slate-700'}">${p.stock} u.</span></td>
            <td class="py-3 px-2 text-right">
                <button onclick="abrirModalProducto('${p.id}')" class="text-purple-600 hover:text-purple-900 font-medium text-xs bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded">Editar</button>
            </td>
        `;
        tablaBody.appendChild(tr);
    });

    // Renderizar Kits / Combos
    combos.forEach(c => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-purple-50 bg-purple-50/20 hover:bg-purple-50/40 text-sm";
        tr.innerHTML = `
            <td class="py-3 px-2 font-semibold text-slate-800"><span class="bg-purple-200 text-purple-800 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded mr-1">Kit</span>${c.nombre}</td>
            <td class="py-3 px-2 text-slate-400 text-xs hidden md:table-cell">${c.descripcion || '-'}</td>
            <td class="py-3 px-2 text-slate-600">$${c.costoTotal.toLocaleString()}</td>
            <td class="py-3 px-2 font-bold text-purple-700">$${c.precioVenta.toLocaleString()}</td>
            <td class="py-3 px-2"><span class="text-xs text-slate-400 italic">Compuesto</span></td>
            <td class="py-3 px-2 text-right">
                <button onclick="abrirModalCombo('${c.id}')" class="text-purple-600 hover:text-purple-900 font-medium text-xs bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded">Editar Kit</button>
            </td>
        `;
        tablaBody.appendChild(tr);
    });
}
