#!/bin/bash
#===============================================================================
# SCRIPT DE INSTALACIÓN COMPLETA - ZORA POS
# Sistema de Punto de Venta para Distribuidora
# Para Fedora 43
#
# Este script instala todas las dependencias necesarias para ejecutar
# el sistema ZORA en un equipo nuevo con Fedora 43.
#
# Uso: sudo ./install-fedora43.sh
#===============================================================================

set -e  # Detener en caso de error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Verificar que se ejecute como root o con sudo
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Este script debe ejecutarse como root o con sudo"
        echo "Uso: sudo $0"
        exit 1
    fi
}

# Obtener el usuario real (no root)
get_real_user() {
    if [ -n "$SUDO_USER" ]; then
        REAL_USER=$SUDO_USER
    else
        REAL_USER=$(whoami)
    fi
    REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)
    print_status "Usuario detectado: $REAL_USER"
    print_status "Directorio home: $REAL_HOME"
}

#===============================================================================
# 1. ACTUALIZAR SISTEMA
#===============================================================================
update_system() {
    print_header "1. ACTUALIZANDO SISTEMA"
    
    print_status "Actualizando paquetes del sistema..."
    dnf upgrade -y --refresh
    
    print_success "Sistema actualizado correctamente"
}

#===============================================================================
# 2. INSTALAR DEPENDENCIAS BÁSICAS
#===============================================================================
install_basic_deps() {
    print_header "2. INSTALANDO DEPENDENCIAS BÁSICAS"
    
    print_status "Instalando herramientas esenciales..."
    dnf install -y \
        git \
        curl \
        wget \
        vim \
        nano \
        htop \
        unzip \
        tar \
        gnupg2 \
        ca-certificates \
        dnf-plugins-core
    
    print_success "Dependencias básicas instaladas"
}

#===============================================================================
# 3. INSTALAR DOCKER
#===============================================================================
install_docker() {
    print_header "3. INSTALANDO DOCKER"
    
    # Verificar si Docker ya está instalado
    if command -v docker &> /dev/null; then
        print_warning "Docker ya está instalado"
        docker --version
    else
        print_status "Agregando repositorio de Docker..."
        
        # Eliminar versiones antiguas si existen
        dnf remove -y docker \
            docker-client \
            docker-client-latest \
            docker-common \
            docker-latest \
            docker-latest-logrotate \
            docker-logrotate \
            docker-selinux \
            docker-engine-selinux \
            docker-engine 2>/dev/null || true
        
        # Agregar repositorio oficial de Docker
        dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo
        
        print_status "Instalando Docker Engine..."
        dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        
        print_success "Docker instalado correctamente"
    fi
    
    # Iniciar y habilitar Docker
    print_status "Habilitando servicio Docker..."
    systemctl start docker
    systemctl enable docker
    
    # Agregar usuario al grupo docker
    print_status "Agregando usuario $REAL_USER al grupo docker..."
    usermod -aG docker "$REAL_USER"
    
    print_success "Docker configurado. El usuario $REAL_USER puede usar Docker sin sudo"
    print_warning "NOTA: Debes cerrar sesión y volver a entrar para que los cambios de grupo surtan efecto"
}

#===============================================================================
# 4. INSTALAR CUPS (SISTEMA DE IMPRESIÓN)
#===============================================================================
install_cups() {
    print_header "4. INSTALANDO SISTEMA DE IMPRESIÓN (CUPS)"
    
    print_status "Instalando CUPS y dependencias..."
    dnf install -y \
        cups \
        cups-libs \
        cups-client \
        system-config-printer \
        foomatic-db \
        foomatic-db-ppds \
        gutenprint \
        gutenprint-cups
    
    # Iniciar y habilitar CUPS
    print_status "Habilitando servicio CUPS..."
    systemctl start cups
    systemctl enable cups
    
    # Configurar CUPS para permitir administración remota (opcional)
    print_status "Configurando CUPS..."
    
    # Agregar usuario al grupo lpadmin para administrar impresoras
    usermod -aG lpadmin "$REAL_USER"
    
    print_success "CUPS instalado y configurado"
    print_status "Puedes administrar impresoras en: http://localhost:631"
}

#===============================================================================
# 5. INSTALAR GIT Y CONFIGURAR
#===============================================================================
configure_git() {
    print_header "5. CONFIGURANDO GIT"
    
    if ! command -v git &> /dev/null; then
        print_status "Instalando Git..."
        dnf install -y git
    fi
    
    print_success "Git instalado: $(git --version)"
    
    print_warning "Recuerda configurar tu identidad de Git:"
    echo "  git config --global user.name \"Tu Nombre\""
    echo "  git config --global user.email \"tu@email.com\""
}

#===============================================================================
# 6. CREAR ESTRUCTURA DE DIRECTORIOS
#===============================================================================
create_directories() {
    print_header "6. CREANDO ESTRUCTURA DE DIRECTORIOS"
    
    PROJECT_DIR="$REAL_HOME/Documentos/PROYECTOS/zora"
    
    print_status "Creando directorios del proyecto..."
    
    # Crear directorios principales
    mkdir -p "$REAL_HOME/Documentos/PROYECTOS"
    
    # Cambiar propietario
    chown -R "$REAL_USER:$REAL_USER" "$REAL_HOME/Documentos/PROYECTOS"
    
    print_success "Directorios creados en: $REAL_HOME/Documentos/PROYECTOS"
}

#===============================================================================
# 7. CLONAR REPOSITORIO (OPCIONAL)
#===============================================================================
clone_repository() {
    print_header "7. CLONAR REPOSITORIO"
    
    PROJECT_DIR="$REAL_HOME/Documentos/PROYECTOS/zora"
    
    if [ -d "$PROJECT_DIR" ]; then
        print_warning "El directorio del proyecto ya existe: $PROJECT_DIR"
        echo ""
        read -p "¿Deseas clonar de nuevo? (s/N): " response
        if [[ "$response" =~ ^[Ss]$ ]]; then
            rm -rf "$PROJECT_DIR"
        else
            print_status "Saltando clonación..."
            return 0
        fi
    fi
    
    print_status "Clonando repositorio..."
    
    # Clonar como el usuario real, no como root
    su - "$REAL_USER" -c "git clone https://github.com/chechere10/Distribuidora.git '$PROJECT_DIR'"
    
    print_success "Repositorio clonado correctamente"
}

#===============================================================================
# 8. CONFIGURAR FIREWALL
#===============================================================================
configure_firewall() {
    print_header "8. CONFIGURANDO FIREWALL"
    
    print_status "Abriendo puertos necesarios..."
    
    # Puerto del frontend
    firewall-cmd --permanent --add-port=5173/tcp 2>/dev/null || true
    # Puerto del backend
    firewall-cmd --permanent --add-port=3001/tcp 2>/dev/null || true
    # Puerto CUPS (impresión)
    firewall-cmd --permanent --add-port=631/tcp 2>/dev/null || true
    
    # Recargar firewall
    firewall-cmd --reload 2>/dev/null || true
    
    print_success "Firewall configurado"
    print_status "Puertos abiertos: 5173 (frontend), 3001 (backend), 631 (CUPS)"
}

#===============================================================================
# 9. CREAR SCRIPT DE INICIO RÁPIDO
#===============================================================================
create_startup_scripts() {
    print_header "9. CREANDO SCRIPTS DE UTILIDAD"
    
    PROJECT_DIR="$REAL_HOME/Documentos/PROYECTOS/zora"
    
    # Script para iniciar el sistema
    cat > "$PROJECT_DIR/start.sh" << 'EOF'
#!/bin/bash
# Script para iniciar ZORA POS
cd "$(dirname "$0")"

echo "🚀 Iniciando ZORA POS..."
docker compose up -d

echo ""
echo "✅ Sistema iniciado!"
echo ""
echo "📊 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:3001"
echo "📝 API Docs: http://localhost:3001/api/docs"
echo ""
echo "Para ver los logs: docker compose logs -f"
EOF

    # Script para detener el sistema
    cat > "$PROJECT_DIR/stop.sh" << 'EOF'
#!/bin/bash
# Script para detener ZORA POS
cd "$(dirname "$0")"

echo "🛑 Deteniendo ZORA POS..."
docker compose down

echo "✅ Sistema detenido"
EOF

    # Script para reiniciar
    cat > "$PROJECT_DIR/restart.sh" << 'EOF'
#!/bin/bash
# Script para reiniciar ZORA POS
cd "$(dirname "$0")"

echo "🔄 Reiniciando ZORA POS..."
docker compose down
docker compose up -d

echo "✅ Sistema reiniciado"
EOF

    # Script para ver logs
    cat > "$PROJECT_DIR/logs.sh" << 'EOF'
#!/bin/bash
# Script para ver logs de ZORA POS
cd "$(dirname "$0")"

docker compose logs -f
EOF

    # Script para backup manual
    cat > "$PROJECT_DIR/backup.sh" << 'EOF'
#!/bin/bash
# Script para hacer backup manual de la base de datos
cd "$(dirname "$0")"

BACKUP_FILE="zora-backup-$(date +%Y-%m-%dT%H-%M-%S).sql"

echo "📦 Creando backup de la base de datos..."
docker compose exec -T db pg_dump -U zora zora > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup creado: $BACKUP_FILE"
    ls -lh "$BACKUP_FILE"
else
    echo "❌ Error al crear backup"
fi
EOF

    # Script para restaurar backup
    cat > "$PROJECT_DIR/restore.sh" << 'EOF'
#!/bin/bash
# Script para restaurar backup de la base de datos
cd "$(dirname "$0")"

if [ -z "$1" ]; then
    echo "Uso: $0 <archivo_backup.sql>"
    echo ""
    echo "Backups disponibles:"
    ls -la *.sql 2>/dev/null || echo "No hay archivos .sql"
    exit 1
fi

if [ ! -f "$1" ]; then
    echo "❌ Archivo no encontrado: $1"
    exit 1
fi

echo "⚠️  ADVERTENCIA: Esto sobrescribirá todos los datos actuales!"
read -p "¿Continuar? (s/N): " response

if [[ ! "$response" =~ ^[Ss]$ ]]; then
    echo "Operación cancelada"
    exit 0
fi

echo "📦 Restaurando backup..."
cat "$1" | docker compose exec -T db psql -U zora zora

if [ $? -eq 0 ]; then
    echo "✅ Backup restaurado correctamente"
else
    echo "❌ Error al restaurar backup"
fi
EOF

    # Script para actualizar el sistema
    cat > "$PROJECT_DIR/update.sh" << 'EOF'
#!/bin/bash
# Script para actualizar ZORA POS
cd "$(dirname "$0")"

echo "🔄 Actualizando ZORA POS..."

# Hacer backup antes de actualizar
./backup.sh

# Obtener cambios del repositorio
echo "📥 Descargando actualizaciones..."
git pull

# Reconstruir contenedores
echo "🔨 Reconstruyendo contenedores..."
docker compose build --no-cache
docker compose up -d

echo "✅ Sistema actualizado"
EOF

    # Script de estado
    cat > "$PROJECT_DIR/status.sh" << 'EOF'
#!/bin/bash
# Script para ver estado de ZORA POS
cd "$(dirname "$0")"

echo "📊 Estado de ZORA POS"
echo "===================="
echo ""
docker compose ps
echo ""
echo "💾 Uso de disco (volúmenes Docker):"
docker system df -v | grep -E "(VOLUME|zora)" | head -10
EOF

    # Hacer ejecutables todos los scripts
    chmod +x "$PROJECT_DIR"/*.sh
    chown "$REAL_USER:$REAL_USER" "$PROJECT_DIR"/*.sh
    
    print_success "Scripts de utilidad creados"
    print_status "Scripts disponibles:"
    echo "  ./start.sh   - Iniciar el sistema"
    echo "  ./stop.sh    - Detener el sistema"
    echo "  ./restart.sh - Reiniciar el sistema"
    echo "  ./logs.sh    - Ver logs en tiempo real"
    echo "  ./backup.sh  - Crear backup de la BD"
    echo "  ./restore.sh - Restaurar backup"
    echo "  ./update.sh  - Actualizar el sistema"
    echo "  ./status.sh  - Ver estado del sistema"
}

#===============================================================================
# 10. CREAR ARCHIVO .ENV (OPCIONAL)
#===============================================================================
create_env_file() {
    print_header "10. CONFIGURANDO VARIABLES DE ENTORNO"
    
    PROJECT_DIR="$REAL_HOME/Documentos/PROYECTOS/zora"
    ENV_FILE="$PROJECT_DIR/.env"
    
    if [ -f "$ENV_FILE" ]; then
        print_warning "Archivo .env ya existe, saltando..."
        return 0
    fi
    
    cat > "$ENV_FILE" << 'EOF'
# ZORA POS - Variables de Entorno
# Modifica estos valores según tu configuración

# Nombre de la impresora CUPS (ejecuta 'lpstat -p' para ver las disponibles)
PRINTER_NAME=Impresora

# Zona horaria
TZ=America/Bogota
EOF

    chown "$REAL_USER:$REAL_USER" "$ENV_FILE"
    
    print_success "Archivo .env creado"
    print_status "Edita $ENV_FILE para personalizar la configuración"
}

#===============================================================================
# 11. PRIMER INICIO DEL SISTEMA
#===============================================================================
first_start() {
    print_header "11. PRIMER INICIO DEL SISTEMA"
    
    PROJECT_DIR="$REAL_HOME/Documentos/PROYECTOS/zora"
    
    cd "$PROJECT_DIR"
    
    print_status "Construyendo imágenes Docker (esto puede tardar varios minutos)..."
    
    # Construir como el usuario real
    su - "$REAL_USER" -c "cd '$PROJECT_DIR' && docker compose build"
    
    print_status "Iniciando servicios..."
    su - "$REAL_USER" -c "cd '$PROJECT_DIR' && docker compose up -d"
    
    # Esperar a que los servicios estén listos
    print_status "Esperando a que los servicios inicien..."
    sleep 15
    
    # Verificar estado
    su - "$REAL_USER" -c "cd '$PROJECT_DIR' && docker compose ps"
    
    print_success "Sistema iniciado!"
}

#===============================================================================
# 12. INSTALAR DEPENDENCIAS OPCIONALES
#===============================================================================
install_optional() {
    print_header "12. DEPENDENCIAS OPCIONALES"
    
    print_status "Instalando Visual Studio Code..."
    rpm --import https://packages.microsoft.com/keys/microsoft.asc 2>/dev/null || true
    
    cat > /etc/yum.repos.d/vscode.repo << 'EOF'
[code]
name=Visual Studio Code
baseurl=https://packages.microsoft.com/yumrepos/vscode
enabled=1
gpgcheck=1
gpgkey=https://packages.microsoft.com/keys/microsoft.asc
EOF
    
    dnf install -y code 2>/dev/null || print_warning "No se pudo instalar VS Code automáticamente"
    
    print_status "Instalando herramientas adicionales..."
    dnf install -y \
        nodejs \
        npm 2>/dev/null || print_warning "Node.js no instalado (no es necesario, Docker lo incluye)"
    
    print_success "Dependencias opcionales instaladas"
}

#===============================================================================
# RESUMEN FINAL
#===============================================================================
print_summary() {
    print_header "INSTALACIÓN COMPLETADA"
    
    PROJECT_DIR="$REAL_HOME/Documentos/PROYECTOS/zora"
    
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║            ZORA POS - INSTALACIÓN EXITOSA                  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "📁 Proyecto instalado en: $PROJECT_DIR"
    echo ""
    echo "🌐 URLs del sistema:"
    echo "   • Frontend: http://localhost:5173"
    echo "   • Backend:  http://localhost:3001"
    echo "   • API Docs: http://localhost:3001/api/docs"
    echo "   • CUPS:     http://localhost:631"
    echo ""
    echo "🔐 Credenciales por defecto:"
    echo "   • Usuario: admin@local"
    echo "   • Contraseña: admin123"
    echo ""
    echo "📋 Comandos útiles:"
    echo "   cd $PROJECT_DIR"
    echo "   ./start.sh   - Iniciar sistema"
    echo "   ./stop.sh    - Detener sistema"
    echo "   ./logs.sh    - Ver logs"
    echo "   ./backup.sh  - Crear backup"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
    echo "   1. Cierra sesión y vuelve a entrar para usar Docker sin sudo"
    echo "   2. Configura tu impresora en http://localhost:631"
    echo "   3. Cambia las credenciales de admin después del primer acceso"
    echo ""
    echo -e "${GREEN}¡Instalación completada exitosamente!${NC}"
}

#===============================================================================
# MENÚ PRINCIPAL
#===============================================================================
show_menu() {
    clear
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║       ZORA POS - INSTALADOR PARA FEDORA 43                 ║"
    echo "║       Sistema de Punto de Venta para Distribuidora         ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "Este script instalará:"
    echo "  • Docker y Docker Compose"
    echo "  • CUPS (sistema de impresión)"
    echo "  • Git"
    echo "  • Configuración de firewall"
    echo "  • Scripts de utilidad"
    echo ""
    echo "Opciones:"
    echo "  1) Instalación completa (recomendado)"
    echo "  2) Solo instalar Docker"
    echo "  3) Solo instalar CUPS"
    echo "  4) Solo crear scripts de utilidad"
    echo "  5) Solo configurar firewall"
    echo "  6) Salir"
    echo ""
    read -p "Selecciona una opción [1-6]: " option
    
    case $option in
        1)
            check_root
            get_real_user
            update_system
            install_basic_deps
            install_docker
            install_cups
            configure_git
            create_directories
            clone_repository
            configure_firewall
            create_startup_scripts
            create_env_file
            first_start
            install_optional
            print_summary
            ;;
        2)
            check_root
            get_real_user
            install_docker
            ;;
        3)
            check_root
            get_real_user
            install_cups
            ;;
        4)
            check_root
            get_real_user
            create_startup_scripts
            ;;
        5)
            check_root
            configure_firewall
            ;;
        6)
            echo "Saliendo..."
            exit 0
            ;;
        *)
            print_error "Opción inválida"
            exit 1
            ;;
    esac
}

#===============================================================================
# PUNTO DE ENTRADA
#===============================================================================
main() {
    # Si se pasa --auto, ejecutar instalación completa sin menú
    if [[ "$1" == "--auto" ]]; then
        check_root
        get_real_user
        update_system
        install_basic_deps
        install_docker
        install_cups
        configure_git
        create_directories
        clone_repository
        configure_firewall
        create_startup_scripts
        create_env_file
        first_start
        install_optional
        print_summary
    else
        show_menu
    fi
}

main "$@"
