namespace Back.Application.Common
{
    public static class Roles
    {
        public const string Administrador = "Administrador";
        public const string Supervisor = "Supervisor";
        public const string Operador = "Operador";
        public const string Repartidor = "Repartidor";

        public const string OperadorOSupervisor = Operador + "," + Supervisor;
        public const string OperadorOSupervisorOAdministrador = Operador + "," + Supervisor + "," + Administrador;
        public const string OperadorORepartidor = Operador + "," + Repartidor;
    }
}
