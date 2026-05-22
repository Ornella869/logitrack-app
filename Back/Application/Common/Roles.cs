namespace Back.Application.Common
{
    public static class Roles
    {
        public const string Administrador = "Administrador";
        public const string Supervisor = "Supervisor";
        public const string Operador = "Operador";
        public const string Repartidor = "Repartidor";
        public const string Gerente = "Gerente";
        public const string UsuarioPortal = "UsuarioPortal";

        public const string OperadorOSupervisor = Operador + "," + Supervisor;
        public const string OperadorOSupervisorOAdministrador = Operador + "," + Supervisor + "," + Administrador;
        public const string OperadorORepartidor = Operador + "," + Repartidor;
        // Épica D: el Gerente gestiona sucursales, tarifas, zonas y umbral de su provincia.
        public const string GerenteOAdministrador = Gerente + "," + Administrador;
        public const string OperadorOSupervisorOGerenteOAdministrador = Operador + "," + Supervisor + "," + Gerente + "," + Administrador;
    }
}
