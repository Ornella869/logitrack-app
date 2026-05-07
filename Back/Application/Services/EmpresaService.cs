using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    public class MiPlanResponse
    {
        public required Guid EmpresaId { get; init; }
        public required string Nombre { get; init; }
        public required PlanEmpresa Plan { get; init; }
        public required int LimiteCuentas { get; init; }
        public required int CuentasActivas { get; init; }
        public required int CuentasDesactivadas { get; init; }
        public required EstadoEmpresa Estado { get; init; }
        public required bool CambioPendiente { get; init; }
        public required PlanEmpresa? PlanDestinoPendiente { get; init; }
    }

    public class PlanCatalogo
    {
        public required PlanEmpresa Plan { get; init; }
        public required string Nombre { get; init; }
        public required int LimiteCuentas { get; init; }
        public required string PrecioMock { get; init; }
        public required List<string> Funcionalidades { get; init; }
    }

    public class EmpresaService
    {
        private readonly LogiTrackDbContext _context;
        private readonly IUserRepository _userRepository;
        private readonly AuditoriaService _auditoria;

        public EmpresaService(LogiTrackDbContext context, IUserRepository userRepository, AuditoriaService auditoria)
        {
            _context = context;
            _userRepository = userRepository;
            _auditoria = auditoria;
        }

        public async Task<Empresa> GetOrCreateSingletonAsync()
        {
            var empresa = await _context.Empresas.FirstOrDefaultAsync();
            if (empresa is not null) return empresa;
            empresa = new Empresa("LogiTrack S.A.", PlanEmpresa.Basico, 50);
            await _context.Empresas.AddAsync(empresa);
            await _context.SaveChangesAsync();
            return empresa;
        }

        public List<PlanCatalogo> GetCatalogo() => new()
        {
            new PlanCatalogo
            {
                Plan = PlanEmpresa.Basico,
                Nombre = "Básico",
                LimiteCuentas = 20,
                PrecioMock = "$50.000 / mes",
                Funcionalidades = new List<string>
                {
                    "Hasta 20 cuentas activas",
                    "Calendarización automática",
                    "Tracking público con QR",
                    "Reportes básicos (CSV)",
                },
            },
            new PlanCatalogo
            {
                Plan = PlanEmpresa.Premium,
                Nombre = "Premium",
                LimiteCuentas = 100,
                PrecioMock = "$180.000 / mes",
                Funcionalidades = new List<string>
                {
                    "Hasta 100 cuentas activas",
                    "Calendarización automática",
                    "Tracking público con QR + GPS",
                    "Reportes avanzados",
                    "Auditoría inmutable",
                    "Soporte prioritario",
                },
            },
        };

        public async Task<MiPlanResponse> GetMiPlanAsync()
        {
            var empresa = await GetOrCreateSingletonAsync();
            var users = await _userRepository.GetAll();
            var activos = users.Count(u => u.Activo);
            var desactivados = users.Count(u => !u.Activo);
            return new MiPlanResponse
            {
                EmpresaId = empresa.Id,
                Nombre = empresa.Nombre,
                Plan = empresa.Plan,
                LimiteCuentas = empresa.LimiteCuentas,
                CuentasActivas = activos,
                CuentasDesactivadas = desactivados,
                Estado = empresa.Estado,
                CambioPendiente = empresa.CodigoCambioPendiente is not null,
                PlanDestinoPendiente = empresa.PlanDestinoPendiente,
            };
        }

        public async Task<int> GetCuentasActivasAsync()
        {
            var users = await _userRepository.GetAll();
            return users.Count(u => u.Activo);
        }

        public async Task ValidarPuedeCrearUsuarioAsync()
        {
            var empresa = await GetOrCreateSingletonAsync();
            if (empresa.Estado == EstadoEmpresa.Suspendida)
                throw new InvalidOperationException("La empresa está suspendida.");
            var activos = await GetCuentasActivasAsync();
            if (activos >= empresa.LimiteCuentas)
                throw new InvalidOperationException($"Has alcanzado el límite de tu plan ({empresa.LimiteCuentas} cuentas). Para agregar más usuarios, contactá a soporte o actualizá el plan.");
        }

        public async Task<string> SolicitarCambioPlanAsync(PlanEmpresa planDestino)
        {
            var empresa = await GetOrCreateSingletonAsync();
            var catalogo = GetCatalogo().First(p => p.Plan == planDestino);
            // Validación de downgrade
            var activos = await GetCuentasActivasAsync();
            if (activos > catalogo.LimiteCuentas)
                throw new InvalidOperationException($"No es posible cambiar al plan {catalogo.Nombre} porque tenés {activos} cuentas activas (más que las {catalogo.LimiteCuentas} permitidas). Desactivá usuarios antes de continuar.");

            empresa.EmitirCodigoCambio(planDestino, catalogo.LimiteCuentas);
            await _context.SaveChangesAsync();
            return empresa.CodigoCambioPendiente!;
        }

        public async Task ConfirmarCambioPlanAsync(string codigo)
        {
            var empresa = await GetOrCreateSingletonAsync();
            var planAnterior = empresa.Plan;
            var ok = empresa.VerificarCodigoYAplicar(codigo);
            await _context.SaveChangesAsync();
            if (!ok) throw new InvalidOperationException("Código de verificación incorrecto.");

            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.Otro,
                $"Cambio de plan: {planAnterior} → {empresa.Plan}",
                contexto: $"Nuevo límite: {empresa.LimiteCuentas} cuentas");
            await _context.SaveChangesAsync();
        }

        public async Task SuspenderAsync()
        {
            var empresa = await GetOrCreateSingletonAsync();
            empresa.Suspender();
            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.Otro,
                "Empresa suspendida (simulación de falta de pago)");
            await _context.SaveChangesAsync();
        }

        public async Task ReactivarAsync()
        {
            var empresa = await GetOrCreateSingletonAsync();
            empresa.Reactivar();
            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.Otro,
                "Empresa reactivada");
            await _context.SaveChangesAsync();
        }
    }
}
