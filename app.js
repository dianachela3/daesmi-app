// =========================================================================
// DAESMI · Cosmetics & Accessories - Lógica del Inventario y Almacenamiento
// =========================================================================

let productos = [];
let combos = [];
let transacciones = [];

// Lista temporal para los productos que el usuario va metiendo al combo actual
let productosEnComboTemporal = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarNavegacion();
    cargarDatosDesdeStorage();
    inicializarModales();
    renderizarInventario();
});

function cargarDatosDesdeStorage() {
    productos = JSON.parse(localStorage.getItem("daesmi_productos")) || [];
    combos = JSON.parse(localStorage.getItem("daesmi_combos")) || [];
    transacciones = JSON.parse(localStorage.getItem("daesmi_transacciones")) || [];
}

function guardarProductosEnStorage() {
    localStorage.setItem("daesmi_productos", JSON.stringify(productos));
}

function guardarCombosEnStorage() {
    localStorage.setItem("daesmi_combos", JSON.stringify(combos));
}

function inicializarNavegacion() {
    const btnBalance = document.getElementById("nav-balance");
    const btnInventario = document.getElementById("nav-inventario");
    const btnAjustes = document.getElementById("nav-ajustes");
    const botones = [btnBalance, btnInventario, btnAjustes];

    function cambiarVista(vistaActivaId, botonActivo) {
        const vistas = ["view-balance", "view-inventario", "view-ajustes"];
        vistas.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden");
        });

        const vistaActiva = document.getElementById(vistaActivaId);
        if (vistaActiva) vistaActiva.classList.remove("hidden");

        botones.forEach(btn => {
            if (btn) {
                btn.classList.remove("text-purple-800");
                btn.classList.add("text-slate-400");
            }
        });

        if (botonActivo) {
            botonActivo.classList.remove("text-slate-400");
            botonActivo.classList.add("text-purple-800");
        }
    }

    if (btnBalance) btnBalance.addEventListener("click", () => cambiarVista("view-balance", btnBalance));
    if (btnInventario) btnInventario.addEventListener("click", () => cambiarVista("view-inventario", btnInventario));
    if (btnAjustes) btnAjustes.addEventListener("click", () => cambiarVista("view-ajustes", btnAjustes));
    
    // Conectar botones de acceso rápido del balance
    document.getElementById("btn-dash-combo").addEventListener("click", () => {
        cambiarVista("view-inventario", btnInventario);
        abrirModalCombo();
    });
}

function inicializarModales() {
    const btnNuevoProd = document.getElementById("btn-nuevo-producto");
    const btnNuevoCombo = document.getElementById("btn-nuevo-combo");
    const modalProd = document.getElementById("modal-producto");
    const modalCombo = document.getElementById("modal-combo");
    
    const btnCerrarModalProd = document.getElementById("btn-cerrar-modal-prod");
    const btnCerrarModalCombo = document.getElementById("btn-cerrar-modal-combo");
    
    const formProducto = document.getElementById("form-producto");
    const formCombo = document.getElementById("form-combo");

    // Modales de Producto Simple
    if (btnNuevoProd) btnNuevoProd.addEventListener("click", () => { modalProd.classList.replace("hidden", "flex"); });
    if (btnCerrarModalProd) {
        btnCerrarModalProd.addEventListener("click", () => {
            modalProd.classList.replace("flex", "hidden");
            formProducto.reset();
        });
    }
    if (formProducto) {
        formProducto.addEventListener("submit", (e) => {
            e.preventDefault();
            const nuevoProducto = {
                id: "prod_" + Date.now(),
                nombre: document.getElementById("prod-nombre").value.trim(),
                costo: parseFloat(document.getElementById("prod-costo").value) || 0,
                precio: parseFloat(document.getElementById("prod-precio").value) || 0,
                stock: parseInt(document.getElementById("prod-stock").value) || 0
            };
            productos.push(nuevoProducto);
            guardarProductosEnStorage();
            renderizarInventario();
            modalProd.classList.replace("flex", "hidden");
            formProducto.reset();
        });
    }

    // Modales de Combo / Kit
    if (btnNuevoCombo) btnNuevoCombo.addEventListener("click", abrirModalCombo);
    if (btnCerrarModalCombo) {
        btnCerrarModalCombo.addEventListener("click", () => {
            modalCombo.classList.replace("flex", "hidden");
            formCombo.reset();
        });
    }

    // Agregar producto seleccionado al listado del combo
    document.getElementById("btn-agregar-item-combo").addEventListener("click", () => {
        const select = document.getElementById("combo-select-producto");
        const productoId = select.value;
        if (!productoId) return;

        const prodEncontrado = productos.find(p => p.id === productoId);
        if (!prodEncontrado) return;

        // Validar si ya se agregó para sumar cantidad
        const existe = productosEnComboTemporal.find(p => p.id === productoId);
        if (existe) {
            existe.cantidad += 1;
        } else {
            productosEnComboTemporal.push({
                id: prodEncontrado.id,
                nombre: prodEncontrado.nombre,
                costo: prodEncontrado.costo,
                precioNormal: prodEncontrado.precio,
                cantidad: 1
            });
        }
        actualizarTablaItemsCombo();
    });

    // Escuchar el precio de venta final puesto por el usuario para calcular la ganancia viva
    document.getElementById("combo-precio-venta").addEventListener("input", calcularGananciaComboLive);

    // Guardar Combo Final
    if (formCombo) {
        formCombo.addEventListener("submit", (e) => {
            e.preventDefault();
            if (productosEnComboTemporal.length === 0) {
                alert("Debes añadir al menos un producto al combo.");
                return;
            }

            const costoTotal = productosEnComboTemporal.reduce((sum, p) => sum + (p.costo * p.cantidad), 0);
            const precioVenta = parseFloat(document.getElementById("combo-precio-venta").value) || 0;

            const nuevoCombo = {
                id: "combo_" + Date.now(),
                nombre: document.getElementById("combo-nombre").value.trim(),
                precioVenta: precioVenta,
                costoTotal: costoTotal,
                ganancia: precioVenta - costoTotal,
                productos: [...productosEnComboTemporal]
            };

            combos.push(nuevoCombo);
            guardarCombosEnStorage();
            renderizarInventario();
            modalCombo.classList.replace("flex", "hidden");
            formCombo.reset();
        });
    }
}

function abrirModalCombo() {
    productosEnComboTemporal = [];
    document.getElementById("form-combo").reset();
    document.getElementById("items-combo-agregados").innerHTML = "";
    document.getElementById("combo-costo-calculado").textContent = "$0.00";
    document.getElementById("combo-ganancia-calculada").textContent = "$0.00";
    
    // Rellenar el selector dinámicamente con los productos que existen en inventario
    const select = document.getElementById("combo-select-producto");
    select.innerHTML = '<option value="">-- Selecciona un producto --</option>';
    productos.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nombre} (Costo: $${p.costo})</option>`;
    });

    const modalCombo = document.getElementById("modal-combo");
    modalCombo.classList.replace("hidden", "flex");
}

function actualizarTablaItemsCombo() {
    const contenedor = document.getElementById("items-combo-agregados");
    contenedor.innerHTML = "";

    let costoTotalAcumulado = 0;

    productosEnComboTemporal.forEach((p, index) => {
        costoTotalAcumulado += p.costo * p.cantidad;
        contenedor.innerHTML += `
            <div class="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                <div>
                    <p class="font-bold text-slate-700">${p.nombre}</p>
                    <p class="text-slate-400">${p.cantidad}x | Costo total: $${(p.costo * p.cantidad).toFixed(2)}</p>
                </div>
                <button type="button" onclick="eliminarItemCombo(${index})" class="text-rose-500 hover:text-rose-700 font-bold px-1 cursor-pointer">X</button>
            </div>
        `;
    });

    document.getElementById("combo-costo-calculado").textContent = `$${costoTotalAcumulado.toFixed(2)}`;
    calcularGananciaComboLive();
}

window.eliminarItemCombo = function(index) {
    productosEnComboTemporal.splice(index, 1);
    actualizarTablaItemsCombo();
};

function calcularGananciaComboLive() {
    const costoTotal = productosEnComboTemporal.reduce((sum, p) => sum + (p.costo * p.cantidad), 0);
    const precioVenta = parseFloat(document.getElementById("combo-precio-venta").value) || 0;
    const ganancia = precioVenta - costoTotal;

    const txtGanancia = document.getElementById("combo-ganancia-calculada");
    txtGanancia.textContent = `$${ganancia.toFixed(2)}`;

    if (ganancia < 0) {
        txtGanancia.className = "text-sm font-black text-rose-600";
    } else {
        txtGanancia.className = "text-sm font-black text-emerald-600";
    }
}

function renderizarInventario() {
    const contenedor = document.getElementById("lista-inventario");
    if (!contenedor) return;

    if (productos.length === 0 && combos.length === 0) {
        contenedor.innerHTML = `
            <div class="bg-white p-8 rounded-xl border border-slate-100 text-center text-slate-400 text-sm w-full">
                <i data-lucide="box" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                No hay productos ni combos en el inventario.
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let html = '';

    // SECCIÓN 1: COMBOS / KITS
    if (combos.length > 0) {
        html += `<h4 class="text-xs font-black uppercase text-purple-400 tracking-wider mt-2">Combos Armados (${combos.length})</h4>
                 <div class="grid grid-cols-1 gap-3">`;
        combos.forEach(c => {
            html += `
                <div class="bg-gradient-to-r from-fuchsia-50 to-purple-50 p-4 rounded-xl border border-purple-100 shadow-xs flex justify-between items-center">
                    <div>
                        <span class="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Combo Kit</span>
                        <h4 class="font-bold text-purple-950 text-sm mt-1">${c.nombre}</h4>
                        <p class="text-xs text-slate-500">Inversión: $${c.costoTotal.toFixed(2)} | Venta Combo: <span class="font-bold text-purple-700">$${c.precioVenta.toFixed(2)}</span></p>
                        <p class="text-xs font-bold text-emerald-600 mt-0.5">Tu Ganancia: +$${c.ganancia.toFixed(2)}</p>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    // SECCIÓN 2: PRODUCTOS SIMPLES
    if (productos.length > 0) {
        html += `<h4 class="text-xs font-black uppercase text-slate-400 tracking-wider mt-4">Productos Individuales (${productos.length})</h4>
                 <div class="grid grid-cols-1 gap-3">`;
        productos.forEach(prod => {
            const gananciaUnitaria = prod.precio - prod.costo;
            html += `
                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex justify-between items-center">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm">${prod.nombre}</h4>
                        <p class="text-xs text-slate-400">Costo: $${prod.costo.toFixed(2)} | Venta: $${prod.precio.toFixed(2)}</p>
                        <p class="text-xs font-semibold text-purple-600 mt-1">Ganancia: +$${gananciaUnitaria.toFixed(2)}</p>
                    </div>
                    <div class="text-right">
                        <span class="px-2 py-1 text-xs font-bold rounded-md ${prod.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                            ${prod.stock} Unds
                        </span>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    contenedor.innerHTML = html;
    lucide.createIcons();
}
