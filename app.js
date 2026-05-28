// =========================================================================
// DAESMI · Cosmetics & Accessories - Lógica del Inventario y Almacenamiento
// =========================================================================

// Estructuras de datos globales en memoria (se sincronizan con LocalStorage)
let productos = [];
let combos = [];
let transacciones = [];

// Esperar a que todo el HTML cargue en el navegador
document.addEventListener("DOMContentLoaded", () => {
    inicializarNavegacion();
    cargarDatosDesdeStorage();
    inicializarModales();
    renderizarInventario();
});

/**
 * Carga los datos guardados en el navegador del usuario
 */
function cargarDatosDesdeStorage() {
    productos = JSON.parse(localStorage.getItem("daesmi_productos")) || [];
    combos = JSON.parse(localStorage.getItem("daesmi_combos")) || [];
    transacciones = JSON.parse(localStorage.getItem("daesmi_transacciones")) || [];
}

/**
 * Guarda el estado actual de los productos en el almacenamiento local
 */
function guardarProductosEnStorage() {
    localStorage.setItem("daesmi_productos", JSON.stringify(productos));
}

/**
 * Maneja el cambio de pestañas en el menú inferior
 */
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
}

/**
 * Controla la apertura y cierre de las ventanas de formulario
 */
function inicializarModales() {
    const btnNuevoProd = document.getElementById("btn-nuevo-producto");
    const modalProd = document.getElementById("modal-producto");
    const btnCerrarModalProd = document.getElementById("btn-cerrar-modal-prod");
    const formProducto = document.getElementById("form-producto");

    // Abrir Modal de Producto
    if (btnNuevoProd && modalProd) {
        btnNuevoProd.addEventListener("click", () => {
            modalProd.classList.remove("hidden");
            modalProd.classList.add("flex");
        });
    }

    // Cerrar Modal de Producto
    if (btnCerrarModalProd && modalProd) {
        btnCerrarModalProd.addEventListener("click", () => {
            modalProd.classList.add("hidden");
            modalProd.classList.remove("flex");
            formProducto.reset();
        });
    }

    // Guardar Producto Simple
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
            
            // Cerrar modal y limpiar
            modalProd.classList.add("hidden");
            modalProd.classList.remove("flex");
            formProducto.reset();
        });
    }
}

/**
 * Dibuja los productos guardados en la pantalla de Inventario
 */
function renderizarInventario() {
    const contenedor = document.getElementById("lista-inventario");
    if (!contenedor) return;

    if (productos.length === 0 && combos.length === 0) {
        contenedor.innerHTML = `
            <div class="bg-white p-8 rounded-xl border border-slate-100 text-center text-slate-400 text-sm">
                <i data-lucide="box" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                No hay productos en el inventario.
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let html = '<div class="grid grid-cols-1 gap-3">';

    // Listar Productos Simples
    productos.forEach(prod => {
        const gananciaUnitaria = prod.precio - prod.costo;
        html += `
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
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

    html += '</div>';
    contenedor.innerHTML = html;
}
