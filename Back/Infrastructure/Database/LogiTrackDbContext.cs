using Back.Domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Text.Json;

namespace Back.Infrastructure.Database
{

    public class LogiTrackDbContext : DbContext
    {
        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<Vehiculo> Vehiculos { get; set; }
        public DbSet<Ruta> Rutas { get; set; }
        public DbSet<Sucursal> Sucursales { get; set; }
        public DbSet<Paquete> Paquetes { get; set; }
        public DbSet<Direccion> Direcciones { get; set; }
        public DbSet<HistorialEstadoEnvio> HistorialEstadosEnvio { get; set; }
        public DbSet<SolicitudComercial> SolicitudesComerciales { get; set; }
        public DbSet<LogAuditoria> LogsAuditoria { get; set; }
        public DbSet<Empresa> Empresas { get; set; }
        public DbSet<ConfiguracionTarifa> ConfiguracionesTarifa { get; set; }
        public DbSet<ZonaPeligrosa> ZonasPeligrosas { get; set; }
        public DbSet<ConsentimientoOjoPatron> ConsentimientosOjoPatron { get; set; }
        public DbSet<Back.Domain.Models.GerenteProvincia> GerentesProvincias { get; set; }
        public DbSet<Back.Domain.Models.GerenteSucursal> GerentesSucursales { get; set; }
        public DbSet<PruebaOjoPatron> PruebasOjoPatron { get; set; }
        public DbSet<ConfiguracionOjoPatron> ConfiguracionesOjoPatron { get; set; }
        public DbSet<Incidencia> Incidencias { get; set; }
        public DbSet<MensajeIncidencia> MensajesIncidencia { get; set; }
        public DbSet<EmailNotificacion> EmailNotificaciones { get; set; }
        public DbSet<OverrideOjoPatron> OverridesOjoPatron { get; set; }

        public DbSet<PuntoPickUp> PuntosPickUp { get; set; }
        public DbSet<HorarioPickUp> HorariosPickUp { get; set; }
        public DbSet<CalificacionPickUp> CalificacionesPickUp { get; set; }
        public DbSet<SatisfaccionEncuesta> SatisfaccionEncuestas { get; set; }
        public DbSet<TramoEnvio> TramosEnvio { get; set; }
        public DbSet<PlantillaEmail> PlantillasEmail { get; set; }
        public DbSet<PermisoRol> PermisosRol { get; set; }
        public DbSet<PermisoUsuario> PermisosUsuario { get; set; }
        public DbSet<DatoEntrenamientoTramo> DatosEntrenamientoTramo { get; set; }
        public DbSet<AlertaRiesgoDemoraMl> AlertasRiesgoDemoraMl { get; set; }
        public DbSet<ModeloVersionTramo> ModeloVersionesTramo { get; set; }

        public LogiTrackDbContext(DbContextOptions<LogiTrackDbContext> options) : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Paquete>(p =>
            {
                p.Property(x => x.CodigoEntrega).HasMaxLength(6).IsRequired();

                // Esto le dice a EF: "Lo que ves en el objeto Remitente,
                // guárdalo en estas columnas específicas de la tabla Paquetes"
                p.OwnsOne(x => x.Remitente, r =>
                {
                    r.Property(c => c.Nombre).HasColumnName("Remitente_Nombre");
                    r.Property(c => c.Apellido).HasColumnName("Remitente_Apellido");
                    r.Property(c => c.Telefono).HasColumnName("Remitente_Telefono");
                    r.Property(c => c.Email).HasColumnName("Remitente_Email").HasMaxLength(160);

                    r.OwnsOne(x => x.Direccion, d =>
                    {
                        d.OwnsOne(x => x.Ubicacion, ubicacion =>
                        {
                            ubicacion.Property(u => u.Latitud).HasColumnName("Remitente_Ubicacion_Latitud");
                            ubicacion.Property(u => u.Longitud).HasColumnName("Remitente_Ubicacion_Longitud");
                        });
                    });
                });

                p.OwnsOne(x => x.Destinatario, d =>
                {
                    d.Property(c => c.Nombre).HasColumnName("Destinatario_Nombre");
                    d.Property(c => c.Apellido).HasColumnName("Destinatario_Apellido");
                    d.Property(c => c.Telefono).HasColumnName("Destinatario_Telefono");
                    d.Property(c => c.Email).HasColumnName("Destinatario_Email").HasMaxLength(160);

                    d.OwnsOne(x => x.Direccion, dir =>
                    {
                        dir.OwnsOne(x => x.Ubicacion, ubicacion =>
                        {
                            ubicacion.Property(u => u.Latitud).HasColumnName("Destinatario_Ubicacion_Latitud");
                            ubicacion.Property(u => u.Longitud).HasColumnName("Destinatario_Ubicacion_Longitud");
                        });
                    });
                });
            });

            modelBuilder.Entity<Usuario>()
                .HasDiscriminator<string>("Discriminator")
                .HasValue<Repartidor>("Repartidor")
                .HasValue<Supervisor>("Supervisor")
                .HasValue<Operador>("Operador")
                .HasValue<Administrador>("Administrador")
                .HasValue<Gerente>("Gerente")
                .HasValue<UsuarioPortal>("UsuarioPortal")
                .HasValue<SocioPickUp>("SocioPickUp");

            modelBuilder.Entity<Repartidor>()
                .Property(x => x.CapacidadCargaKg)
                .HasDefaultValue(500d);

            // Épica D: cobertura de provincias por sucursal, persistida como JSON.
            modelBuilder.Entity<Sucursal>(s =>
            {
                s.Property(x => x.CapacidadAlmacenamientoPaquetes).HasDefaultValue(1000);
                s.Property(x => x.ProvinciasCubiertas)
                    .HasConversion(
                        v => JsonSerializer.Serialize(v ?? new List<string>(), (JsonSerializerOptions?)null),
                        // Tolerante a filas viejas con "" o null (no son JSON válido) → lista vacía.
                        v => string.IsNullOrWhiteSpace(v)
                            ? new List<string>()
                            : (JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>()))
                    .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                        (a, b) => (a ?? new()).SequenceEqual(b ?? new()),
                        v => v.Aggregate(0, (acc, str) => HashCode.Combine(acc, str.GetHashCode())),
                        v => v.ToList()));
            });

            modelBuilder.Entity<HistorialEstadoEnvio>(h =>
            {
                h.HasKey(x => x.Id);
                h.HasIndex(x => x.PaqueteId);
                h.HasIndex(x => x.FechaHora);
            });

            modelBuilder.Entity<Empresa>(e =>
            {
                e.HasKey(x => x.Id);
                e.Property(x => x.Nombre).HasMaxLength(160).IsRequired();
                e.Property(x => x.CodigoCambioPendiente).HasMaxLength(10);
            });

            modelBuilder.Entity<LogAuditoria>(l =>
            {
                l.HasKey(x => x.Id);
                l.Property(x => x.UsuarioNombre).HasMaxLength(160);
                l.Property(x => x.UsuarioRol).HasMaxLength(40);
                l.Property(x => x.RecursoId).HasMaxLength(100);
                l.Property(x => x.Descripcion).HasMaxLength(500);
                l.Property(x => x.Contexto).HasMaxLength(2000);
                l.HasIndex(x => x.Timestamp);
                l.HasIndex(x => x.UsuarioId);
                l.HasIndex(x => x.Accion);
            });

            modelBuilder.Entity<PermisoRol>(p =>
            {
                p.HasKey(x => x.Id);
                p.Property(x => x.Rol).HasMaxLength(40).IsRequired();
                p.Property(x => x.Permiso).HasMaxLength(80).IsRequired();
                p.HasIndex(x => new { x.Rol, x.Permiso }).IsUnique();
            });

            modelBuilder.Entity<PermisoUsuario>(p =>
            {
                p.HasKey(x => x.Id);
                p.Property(x => x.Permiso).HasMaxLength(80).IsRequired();
                p.HasIndex(x => new { x.UsuarioId, x.Permiso }).IsUnique();
                p.HasOne<Usuario>().WithMany().HasForeignKey(x => x.UsuarioId).OnDelete(DeleteBehavior.Cascade);
                p.Property(x => x.SucursalesPermitidasIds)
                    .HasColumnName("SucursalesPermitidasIds")
                    .HasConversion(
                        v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                        v => string.IsNullOrWhiteSpace(v) ? null : JsonSerializer.Deserialize<List<Guid>>(v, (JsonSerializerOptions?)null))
                    .Metadata.SetValueComparer(new ValueComparer<List<Guid>>(
                        (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
                        v => v == null ? 0 : v.Aggregate(0, (acc, id) => HashCode.Combine(acc, id.GetHashCode())),
                        v => v == null ? null : v.ToList()));
            });

            modelBuilder.Entity<DatoEntrenamientoTramo>(d =>
            {
                d.HasKey(x => x.Id);
                d.Property(x => x.TipoEnvio).HasMaxLength(40).IsRequired();
                d.HasIndex(x => new { x.SucursalOrigenId, x.SucursalDestinoId })
                    .HasDatabaseName("IX_DatosEntrenamientoTramo_SucursalOrigen_Destino");
            });

            modelBuilder.Entity<AlertaRiesgoDemoraMl>(a =>
            {
                a.HasKey(x => x.Id);
                a.Property(x => x.CodigoSeguimiento).HasMaxLength(20).IsRequired();
                a.Property(x => x.CausaPrincipal).HasMaxLength(500).IsRequired();
                a.HasIndex(x => x.PaqueteId)
                    .HasDatabaseName("IX_AlertasRiesgoDemoraMl_PaqueteId");
            });

            modelBuilder.Entity<SolicitudComercial>(s =>
            {
                s.HasKey(x => x.Id);
                s.Property(x => x.NombreEmpresa).HasMaxLength(160);
                s.Property(x => x.NombreContacto).HasMaxLength(160);
                s.Property(x => x.Email).HasMaxLength(160);
                s.Property(x => x.Telefono).HasMaxLength(50);
                s.Property(x => x.PlanInteres).HasMaxLength(80);
                s.Property(x => x.Comentarios).HasMaxLength(2000);
                s.Property(x => x.CreadoEn);
                s.HasIndex(x => x.CreadoEn);
                s.HasIndex(x => x.Email);
            });

            modelBuilder.Entity<Incidencia>(i =>
            {
                i.HasKey(x => x.Id);
                i.Property(x => x.Origen).HasMaxLength(40);
                i.Property(x => x.Tipo).HasMaxLength(60);
                i.Property(x => x.TipoLabel).HasMaxLength(120);
                i.Property(x => x.Estado).HasMaxLength(40);
                i.Property(x => x.Severidad).HasMaxLength(20);
                i.Property(x => x.CodigoSeguimiento).HasMaxLength(80);
                i.Property(x => x.EmailContacto).HasMaxLength(160);
                i.Property(x => x.RepartidorNombre).HasMaxLength(160);
                i.Property(x => x.Descripcion).HasMaxLength(1000);
                i.HasIndex(x => x.SucursalId);
                i.HasIndex(x => x.PaqueteId);
                i.HasIndex(x => x.FechaReporte);
            });

            modelBuilder.Entity<EmailNotificacion>(e =>
            {
                e.HasKey(x => x.Id);
                e.Property(x => x.DestinatarioEmail).HasMaxLength(160).IsRequired();
                e.Property(x => x.Asunto).HasMaxLength(250).IsRequired();
                e.Property(x => x.Cuerpo).IsRequired();
                e.Property(x => x.CodigoSeguimiento).HasMaxLength(80);
                e.Property(x => x.Error).HasMaxLength(1000);
                e.HasIndex(x => x.PaqueteId);
                e.HasIndex(x => x.SucursalId);
                e.HasIndex(x => x.Estado);
                e.HasIndex(x => x.CreadoEn);
            });

            modelBuilder.Entity<OverrideOjoPatron>(o =>
            {
                o.HasKey(x => x.Id);
                o.Property(x => x.Motivo).HasMaxLength(500);
                o.Property(x => x.ComentarioSupervisor).HasMaxLength(500);
                o.HasIndex(x => x.RepartidorId);
                o.HasIndex(x => x.SupervisorId);
                o.HasIndex(x => x.SolicitadoEn);
            });

            modelBuilder.Entity<ConfiguracionOjoPatron>(c =>
            {
                c.Property(x => x.Activo).HasDefaultValue(true);
            });

            modelBuilder.Entity<PuntoPickUp>(p =>
            {
                p.HasKey(x => x.Id);
                p.Property(x => x.Nombre).HasMaxLength(160).IsRequired();
                p.Property(x => x.Direccion).HasMaxLength(240).IsRequired();
                p.Property(x => x.Localidad).HasMaxLength(120).IsRequired();
                p.Property(x => x.CodigoPostal).HasMaxLength(20).IsRequired();
                p.Property(x => x.Provincia).HasMaxLength(80).IsRequired();
                p.Property(x => x.Horarios).HasMaxLength(300).IsRequired();
                p.Property(x => x.CapacidadDiaria).HasDefaultValue(100);
                p.Property(x => x.Telefono).HasMaxLength(50);
                p.HasIndex(x => x.Provincia);
                p.HasIndex(x => x.Activo);
            });

            modelBuilder.Entity<HorarioPickUp>(h =>
            {
                h.HasKey(x => new { x.PuntoPickUpId, x.DiaSemana });
                h.HasOne<PuntoPickUp>().WithMany().HasForeignKey(x => x.PuntoPickUpId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<SatisfaccionEncuesta>(e =>
            {
                e.HasKey(x => x.Id);
                e.HasIndex(x => x.Token).IsUnique();
                e.HasIndex(x => x.PaqueteId);
                e.HasOne(x => x.Paquete)
                    .WithMany()
                    .HasForeignKey(x => x.PaqueteId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<TramoEnvio>(t =>
            {
                t.HasKey(x => x.Id);
                t.HasIndex(x => new { x.PaqueteId, x.Orden }).IsUnique();
                t.HasIndex(x => new { x.SucursalOrigenId, x.Estado });
                t.HasIndex(x => new { x.SucursalDestinoId, x.Estado });
                t.HasOne<Paquete>()
                    .WithMany()
                    .HasForeignKey(x => x.PaqueteId)
                    .OnDelete(DeleteBehavior.Cascade);
                t.HasOne<Sucursal>()
                    .WithMany()
                    .HasForeignKey(x => x.SucursalOrigenId)
                    .OnDelete(DeleteBehavior.Restrict);
                t.HasOne<Sucursal>()
                    .WithMany()
                    .HasForeignKey(x => x.SucursalDestinoId)
                    .OnDelete(DeleteBehavior.Restrict);
            });


        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<Paquete>())
            {
                if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
                {

                }
            }
            return await base.SaveChangesAsync(cancellationToken);
        }

    }
}
