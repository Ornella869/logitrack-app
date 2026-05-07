using Back.Domain.Models;
using Microsoft.EntityFrameworkCore;

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

        public LogiTrackDbContext(DbContextOptions<LogiTrackDbContext> options) : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Paquete>(p =>
            {
                // Esto le dice a EF: "Lo que ves en el objeto Remitente,
                // guárdalo en estas columnas específicas de la tabla Paquetes"
                p.OwnsOne(x => x.Remitente, r =>
                {
                    r.Property(c => c.Nombre).HasColumnName("Remitente_Nombre");
                    r.Property(c => c.Apellido).HasColumnName("Remitente_Apellido");
                    r.Property(c => c.Telefono).HasColumnName("Remitente_Telefono");

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
                .HasValue<Administrador>("Administrador");

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
