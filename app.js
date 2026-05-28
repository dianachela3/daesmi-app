// =========================================================================
// DAESMI · Cosmetics & Accessories - Control Total de Inventario y Combos
// =========================================================================

let productos = [];
let combos = [];
let transacciones = [];

// Estado para el armado de combos
let productosEnComboTemporal = [];
// Guarda el ID del elemento que estamos editando actualmente
let idElementoEdicion = null; 

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
    
    // Asegurar que todos los productos viejos tengan la propiedad 'activo'
    productos.forEach(p => { if (p.activo === undefined) p.activo = true; });
    combos.forEach(c => { if (c.activo === undefined) c.activo = true; });
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
    
    document.getElementById("btn-dash-combo").addEventListener("click", () => {
        cambiarVista("view-inventario", btnInventario);
        abrirModalCombo();
    });
}

function inicializarModales() {
    const modalProd = document.getElementById("modal-producto");
    const modalCombo = document.getElementById("modal-combo");
    const formProducto = document.getElementById("form-producto");
    const formCombo = document.getElementById("form-combo");

    // Abrir creación
    document.getElementById("btn-nuevo-producto").addEventListener("click", () => abrirModalProducto());
    document.getElementById("btn-nuevo-combo").addEventListener("click", () => abrirModalCombo());
    
    // Cerrar modales
    document.getElementById("btn-cerrar-modal-prod").addEventListener("click", () => {
        modalProd.classList.replace("flex", "hidden");
    });
    document.getElementById("btn-cerrar-modal-combo").addEventListener("click", () => {
        modalCombo.classList.replace("flex", "hidden");
    });

    // Guardar o Actualizar Producto
    formProducto.addEventListener("submit", (e) => {
        e.preventDefault();
        const nombre = document.getElementById("prod-nombre").value.trim();
        const costo = parseFloat(document.getElementById("prod-costo").value) || 0;
        const precio = parseFloat(document.getElementById("prod-precio").value) || 0;
        const stock = parseInt(document.getElementById("prod-stock").value) || 0;

        if (idElementoEdicion) {
            // Modo Edición
            const index = productos.findIndex(p => p.id === idElementoEdicion);
            if (index !== -1) {
                productos[index].nombre = nombre;
                productos[index].costo = costo;
                productos[index].precio = precio;
                productos[index].stock = stock;
            }
        } else {
            // Modo Creación Nueva
            productos.push({ id: "prod_" + Date.now(), nombre, costo, precio, stock, activo: true });
        }

        guardarProductosEnStorage();
        renderizarInventario();
        modalProd.classList.replace("flex", "hidden");
    });

    // Añadir ítems al listado del combo
    document.getElementById("btn-agregar-item-combo").addEventListener("click", () => {
        const select = document.getElementById("combo-select-producto");
        const productoId = select.value;
        if (!productoId) return;

        const prodEncontrado = productos.find(p => p.id === productoId);
        if (!prodEncontrado) return;

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

    document.getElementById("combo-precio-venta").addEventListener("input", calcularGananciaComboLive);

    // Guardar o Actualizar Combo
    formCombo.addEventListener("submit", (e) => {
        e.preventDefault();
        if (productosEnComboTemporal.length === 0) {
            alert("Debes añadir al menos un producto al combo.");
            return;
        }

        const nombre = document.getElementById("combo-nombre").value.trim();
        const precioVenta = parseFloat(document.getElementById("combo-precio-venta").value) || 0;
        const costoTotal = productosEnComboTemporal.reduce((sum, p) => sum + (p.costo * p.cantidad), 0);

        if (idElementoEdicion) {
            // Modo Edición
            const index = combos.findIndex(c => c.id === idElementoEdicion);
            if (index !== -1) {
                combos[index].nombre = nombre;
                combos[index].precioVenta = precioVenta;
                combos[index].costoTotal = costoTotal;
                combos[index].ganancia = precioVenta - costoTotal;
                combos[index].productos = [...productosEnComboTemporal];
            }
        } else {
            // Modo Creación Nueva
            combos.push({
                id: "combo_" + Date.now(),
                nombre,
                precioVenta,
                costoTotal,
                ganancia: precioVenta - costoTotal,
                productos: [...productosEnComboTemporal],
                activo: true
            });
        }

        guardarCombosEnStorage();
        renderizarInventario();
        modalCombo.classList.replace("flex", "hidden");
    });
}

// --- CONTROLADORES DE MODALES ---

function abrirModalProducto(id = null) {
    idElementoEdicion = id;
    const form = document.getElementById("form-producto");
    const titulo = document.querySelector("#modal-producto h4");
    form.reset();

    if (id) {
        titulo.textContent = "Editar Producto";
        const prod = productos.find(p => p.id === id);
        if (prod) {
            document.getElementById("prod-nombre").value = prod.nombre;
            document.getElementById("prod-costo").value = prod.costo;
            document.getElementById("prod-precio").value = prod.precio;
            document.getElementById("prod-stock").value = prod.stock;
        }
    } else {
        titulo.textContent = "Añadir Nuevo Producto";
    }
    document.getElementById("modal-producto").classList.replace("hidden", "flex");
}

function abrirModalCombo(id = null) {
    idElementoEdicion = id;
    const form = document.getElementById("form-combo");
    const titulo = document.querySelector("#modal-combo h4");
    form.reset();
    productosEnComboTemporal = [];
    document.getElementById("items-combo-agregados").innerHTML = "";

    // Llenar selector solo con productos activos
    const select = document.getElementById("combo-select-producto");
    select.innerHTML = '<option value="">-- Selecciona un producto --</option>';
    productos.filter(p => p.activo).forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nombre} (Costo: $${p.costo})</option>`;
    });

    if (id) {
        titulo.textContent = "Editar Combo Kit";
        const combo = combos.find(c => c.id === id);
        if (combo) {
            document.getElementById("combo-nombre").value = combo.nombre;
            document.getElementById("combo-precio-venta").value = combo.precioVenta;
            productosEnComboTemporal = [...combo.productos];
            actualizarTablaItemsCombo();
        }
    } else {
        titulo.textContent = "Armar Nuevo Combo";
        document.getElementById("combo-costo-calculado").textContent = "$0.00";
        document.getElementById("combo-ganancia-calculada").textContent = "$0.00";
    }
    document.getElementById("modal-combo").classList.replace("hidden", "flex");
}

function actualizarTablaItemsCombo() {
    const contenedor = document.getElementById("items-combo-agregados");
    contenedor.innerHTML = "";
    let costoTotalAcumulado = 0;

    productosEnComboTemporal.forEach((p, index) => {
        costoTotalAcumulado += p.costo * p.cantidad;
        contenedor.innerHTML += `
            <div class="flex justify-between items-center bg-slate-100 p-2 rounded-lg text-[11px]">
                <div>
                    <p class="font-bold text-slate-700">${p.nombre}</p>
                    <p class="text-slate-500">${p.cantidad}x | Total: $${(p.costo * p.cantidad).toFixed(2)}</p>
                </div>
                <button type="button" onclick="eliminarItemCombo(${index})" class="text-rose-500 hover:text-rose-700 font-bold px-1 cursor-pointer">✕</button>
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
    txtGanancia.className = `text-sm font-black ${ganancia < 0 ? 'text-rose-600' : 'text-emerald-600'}`;
}

// --- FUNCIONES GLOBALES DE ACCIÓN (EDITAR, DESHABILITAR, ELIMINAR) ---

window.editarProducto = (id) => abrirModalProducto(id);
window.editarCombo = (id) => abrirModalCombo(id);

window.conmutarEstadoProducto = (id) => {
    const index = productos.findIndex(p => p.id === id);
    if (index !== -1) {
        productos[index].activo = !productos[index].activo;
        guardarProductosEnStorage();
        renderizarInventario();
    }
};

window.conmutarEstadoCombo = (id) => {
    const index = combos.findIndex(c => c.id === id);
    if (index !== -1) {
        combos[index].activo = !combos[index].activo;
        guardarCombosEnStorage();
        renderizarInventario();
    }
};

window.eliminarProducto = (id) => {
    if (confirm("¿Estás seguro de eliminar este producto por completo? Se borrará permanentemente de los inventarios.")) {
        productos = productos.filter(p => p.id !== id);
        guardarProductosEnStorage();
        renderizarInventario();
    }
};

window.eliminarCombo = (id) => {
    if (confirm("¿Seguro que deseas eliminar este combo por completo?")) {
        combos = combos.filter(c => c.id !== id);
        guardarCombosEnStorage();
        renderizarInventario();
    }
};

// --- RENDERIZADO DEL INVENTARIO ---

function renderizarInventario() {
    const contenedor = document.getElementById("lista-inventario");
    if (!contenedor) return;

    if (productos.length === 0 && combos.length === 0) {
        contenedor.innerHTML = `
            <div class="bg-white p-8 rounded-xl border border-slate-100 text-center text-slate-400 text-sm w-full">
                <i data-lucide="box" class="w-8 h-8 mx-auto mb-2 opacity-50"></i> No hay artículos registrados.
            </div>
        `;
        return;
    }

    let html = '';

    // RENDER COMBOS
    if (combos.length > 0) {
        html += `<h4 class="text-xs font-black uppercase text-purple-400 tracking-wider mt-2 mb-1">Combos Armados (${combos.length})</h4>`;
        combos.forEach(c => {
            html += `
                <div class="p-4 rounded-xl border transition-all ${c.activo ? 'bg-gradient-to-r from-fuchsia-50 to-purple-50 border-purple-100' : 'bg-slate-50 border-slate-200 opacity-60'}">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${c.activo ? 'bg-purple-600 text-white' : 'bg-slate-400 text-white'}">
                                ${c.activo ? 'Combo Activo' : 'Deshabilitado'}
                            </span>
                            <h4 class="font-bold text-slate-800 text-sm mt-1">${c.nombre}</h4>
                            <p class="text-xs text-slate-500">Inversión: $${c.costoTotal.toFixed(2)} | Venta: <span class="font-bold text-purple-700">$${c.precioVenta.toFixed(2)}</span></p>
                            <p class="text-xs font-bold text-emerald-600">Ganancia: +$${c.ganancia.toFixed(2)}</p>
                        </div>
                        
                        <!-- Panel de Acciones -->
                        <div class="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs p-1 rounded-lg border border-slate-100 shadow-xs">
                            <button onclick="editarCombo('${c.id}')" class="text-slate-500 hover:text-purple-700 p-1 rounded-md hover:bg-slate-100 cursor-pointer" title="Editar"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                            <button onclick="conmutarEstadoCombo('${c.id}')" class="text-slate-500 hover:text-amber-600 p-1 rounded-md hover:bg-slate-100 cursor-pointer" title="${c.activo ? 'Deshabilitar' : 'Habilitar'}">
                                <i data-lucide="${c.activo ? 'eye' : 'eye-off'}" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="eliminarCombo('${c.id}')" class="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-slate-100 cursor-pointer" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // RENDER PRODUCTOS
    if (productos.length > 0) {
        html += `<h4 class="text-xs font-black uppercase text-slate-400 tracking-wider mt-4 mb-1">Productos Individuales (${productos.length})</h4>`;
        productos.forEach(p => {
            const ganancia = p.precio - p.costo;
            html += `
                <div class="bg-white p-4 rounded-xl border transition-all ${p.activo ? 'border-slate-100 shadow-xs' : 'border-slate-200 bg-slate-50/70 opacity-60'} flex justify-between items-center">
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-slate-800 text-sm">${p.nombre}</h4>
                            ${!p.activo ? '<span class="text-[9px] bg-slate-300 text-slate-600 px-1.5 py-0.2 rounded font-bold uppercase">Inactivo</span>' : ''}
                        </div>
                        <p class="text-xs text-slate-400">Costo: $${p.costo.toFixed(2)} | Venta: $${p.precio.toFixed(2)}</p>
                        <p class="text-xs font-semibold text-purple-600">Ganancia: +$${ganancia.toFixed(2)}</p>
                    </div>
                    
                    <div class="flex flex-col items-end gap-2">
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-md ${p.stock > 0 && p.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                            ${p.stock} Unds
                        </span>
                        
                        <!-- Panel de Acciones -->
                        <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100 shadow-xs">
                            <button onclick="editarProducto('${p.id}')" class="text-slate-500 hover:text-purple-700 p-1 rounded-md hover:bg-white cursor-pointer" title="Editar"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                            <button onclick="conmutarEstadoProducto('${p.id}')" class="text-slate-500 hover:text-amber-600 p-1 rounded-md hover:bg-white cursor-pointer" title="${p.activo ? 'Deshabilitar' : 'Habilitar'}">
                                <i data-lucide="${p.activo ? 'eye' : 'eye-off'}" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="eliminarProducto('${p.id}')" class="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-white cursor-pointer" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    contenedor.innerHTML = html;
    lucide.createIcons();
}
