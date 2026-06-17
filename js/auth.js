/**
 * Sistema de Autenticación DAESMI OS
 * Escucha en tiempo real el estado de la sesión para proteger la UI.
 */
function protegerPantalla(callbackSincronizacion) {
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged((user) => {
            const paginaActual = window.location.pathname;

            if (user) {
                // Usuario autenticado correctamente
                console.log("✅ DAESMI OS - Sesión activa:", user.email);
                
                // Actualizar el nombre en la interfaz si existe el elemento
                const userEl = document.getElementById('sessionUser');
                if (userEl) userEl.textContent = user.email.split('@')[0];
                
                // Ejecutar la función de carga de datos (callback) instantáneamente
                if (typeof callbackSincronizacion === 'function') {
                    callbackSincronizacion();
                }
            } else {
                // No hay usuario: Redirigir si no estamos en la página de login (index.html)
                console.warn("🚫 Acceso denegado. Redireccionando a login...");
                if (!paginaActual.includes('index.html')) {
                    window.location.href = "index.html";
                }
            }
        });
    } else {
        console.error("❌ Firebase no ha cargado correctamente. Verifica los scripts.");
    }
}

/**
 * Función global para cerrar sesión de forma segura
 */
window.cerrarSesionPlataforma = function() {
    if(confirm("¿Deseas cerrar sesión en DAESMI OS?")) {
        firebase.auth().signOut().then(() => {
            window.location.href = "index.html";
        }).catch(err => console.error("Error al cerrar sesión: ", err));
    }
};