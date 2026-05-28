// =========================================================================
// DAESMI · Cosmetics & Accessories - Sistema de Navegación y Vistas Base
// =========================================================================

// Esperar a que todo el HTML cargue en el navegador
document.addEventListener("DOMContentLoaded", () => {
    inicializarNavegacion();
});

/**
 * Maneja el cambio de pestañas en el menú inferior (Estilo App Móvil)
 */
function inicializarNavegacion() {
    // Seleccionamos los botones del menú inferior
    // Nota: Para que funcione, modificaremos levemente los botones en el HTML agregándoles un 'id'
    const btnBalance = document.getElementById("nav-balance");
    const btnInventario = document.getElementById("nav-inventario");
    const btnAjustes = document.getElementById("nav-ajustes");

    // Array de botones para iterar fácilmente
    const botones = [btnBalance, btnInventario, btnAjustes];

    // Función para cambiar de vista de forma visual
    function cambiarVista(vistaActivaId, botonActivo) {
        // 1. Ocultar todas las secciones de contenido
        const vistas = ["view-balance", "view-inventario", "view-ajustes"];
        vistas.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden"); // Tailwind oculta con 'hidden'
        });

        // 2. Mostrar solo la vista seleccionada
        const vistaActiva = document.getElementById(vistaActivaId);
        if (vistaActiva) vistaActiva.classList.remove("hidden");

        // 3. Resetear estilos de todos los botones de navegación
        botones.forEach(btn => {
            if (btn) {
                btn.classList.remove("text-purple-800");
                btn.classList.add("text-slate-400");
            }
        });

        // 4. Activar visualmente el botón seleccionado
        if (botonActivo) {
            botonActivo.classList.remove("text-slate-400");
            botonActivo.classList.add("text-purple-800");
        }
    }

    // Asignar los eventos de clic si los botones existen
    if (btnBalance) {
        btnBalance.addEventListener("click", () => cambiarVista("view-balance", btnBalance));
    }
    if (btnInventario) {
        btnInventario.addEventListener("click", () => cambiarVista("view-inventario", btnInventario));
    }
    if (btnAjustes) {
        btnAjustes.addEventListener("click", () => cambiarVista("view-ajustes", btnAjustes));
    }
}