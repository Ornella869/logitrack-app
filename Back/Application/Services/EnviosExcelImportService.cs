using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Back.Controllers;
using Back.Domain.Models;

namespace Back.Application.Services
{
    public record ImportarEnvioRow(int Fila, RegistrarPaqueteRequest Request);

    public class EnviosExcelImportService
    {
        public static readonly string[] Headers =
        {
            "DestinatarioNombre", "DestinatarioApellido", "ModalidadEntrega", "PuntoPickUpId",
            "DestinatarioDireccion", "DestinatarioLocalidad", "DestinatarioCP", "DestinatarioProvincia", "DestinatarioTelefono", "DestinatarioEmail",
            "Peso", "TipoEnvio", "TipoPaquete", "Comentarios"
        };

        public byte[] GenerarTemplate(IEnumerable<PuntoPickUp>? pickUps = null)
        {
            var pickUpsList = pickUps?.ToList() ?? new List<PuntoPickUp>();
            using var ms = new MemoryStream();
            using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true))
            {
                Add(zip, "[Content_Types].xml",
                    """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>""");
                Add(zip, "_rels/.rels",
                    """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
                Add(zip, "xl/workbook.xml",
                    """<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Envios" sheetId="1" r:id="rId1"/><sheet name="Opciones" sheetId="2" r:id="rId2"/><sheet name="PickUps" sheetId="3" r:id="rId3"/></sheets></workbook>""");
                Add(zip, "xl/_rels/workbook.xml.rels",
                    """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>""");
                Add(zip, "xl/worksheets/sheet1.xml", BuildSheetXml(pickUpsList.Count));
                Add(zip, "xl/worksheets/sheet2.xml", BuildOptionsSheetXml());
                Add(zip, "xl/worksheets/sheet3.xml", BuildPickUpsSheetXml(pickUpsList));
            }
            return ms.ToArray();
        }

        public async Task<List<ImportarEnvioRow>> ParseAsync(IFormFile file)
        {
            await using var stream = file.OpenReadStream();
            if (file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
                return ParseXlsx(stream);
            return ParseCsv(stream);
        }

        private static string BuildSheetXml(int pickUpsCount)
        {
            var headerCells = string.Join("", Headers.Select((h, i) => Cell(i + 1, 1, h)));
            var placeholders = new[]
            {
                "Completar", "Completar", "Elegir Domicilio/PickUp", "Solo si es PickUp",
                "Solo Domicilio", "Solo Domicilio", "Solo Domicilio", "Solo Domicilio", "Completar", "Completar",
                "Ej: 4.5", "Elegir", "Elegir", "Opcional"
            };
            var placeholderCells = string.Join("", placeholders.Select((h, i) => Cell(i + 1, 2, h)));
            var pickUpsRangeEnd = Math.Max(2, pickUpsCount + 1);
            return $"""<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="14" width="24" customWidth="1"/><col min="4" max="4" width="58" customWidth="1"/><col min="14" max="14" width="46" customWidth="1"/></cols><sheetData><row r="1">{headerCells}</row><row r="2">{placeholderCells}</row></sheetData><dataValidations count="4"><dataValidation type="list" allowBlank="0" showErrorMessage="1" sqref="C2:C1000"><formula1>Opciones!$A$2:$A$3</formula1></dataValidation><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="D2:D1000"><formula1>PickUps!$A$2:$A${pickUpsRangeEnd}</formula1></dataValidation><dataValidation type="list" allowBlank="0" showErrorMessage="1" sqref="L2:L1000"><formula1>Opciones!$B$2:$B$3</formula1></dataValidation><dataValidation type="list" allowBlank="0" showErrorMessage="1" sqref="M2:M1000"><formula1>Opciones!$C$2:$C$4</formula1></dataValidation></dataValidations></worksheet>""";
        }

        private static string BuildOptionsSheetXml()
        {
            var rows = new List<string>
            {
                Row(1, "ModalidadEntrega", "TipoEnvio", "TipoPaquete"),
                Row(2, "Domicilio", "Comun", "Comun"),
                Row(3, "PickUp", "Prioritario", "Fragil"),
                Row(4, "", "", "Pesado"),
            };
            return $"""<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="3" width="22" customWidth="1"/></cols><sheetData>{string.Join("", rows)}</sheetData></worksheet>""";
        }

        private static string BuildPickUpsSheetXml(List<PuntoPickUp> pickUps)
        {
            var rows = new List<string> { Row(1, "SeleccionarEnEnvios", "Id", "Nombre", "Provincia", "Localidad", "Direccion", "Horarios", "CapacidadDiaria") };
            rows.AddRange(pickUps.Select((p, i) => Row(
                i + 2,
                $"{p.Nombre} | {p.Provincia} | {p.Localidad} | {p.Id}",
                p.Id.ToString(),
                p.Nombre,
                p.Provincia,
                p.Localidad,
                p.Direccion,
                p.Horarios,
                p.CapacidadDiaria.ToString(CultureInfo.InvariantCulture))));
            return $"""<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="72" customWidth="1"/><col min="2" max="8" width="28" customWidth="1"/></cols><sheetData>{string.Join("", rows)}</sheetData></worksheet>""";
        }

        private static string Row(int row, params string[] values)
        {
            return $"""<row r="{row}">{string.Join("", values.Select((h, i) => Cell(i + 1, row, h)))}</row>""";
        }

        private static string Cell(int col, int row, string value)
        {
            var reference = $"{ColumnName(col)}{row}";
            return $"""<c r="{reference}" t="inlineStr"><is><t>{SecurityElement.Escape(value)}</t></is></c>""";
        }

        private static string ColumnName(int index)
        {
            var name = string.Empty;
            while (index > 0)
            {
                index--;
                name = (char)('A' + index % 26) + name;
                index /= 26;
            }
            return name;
        }

        private static void Add(ZipArchive zip, string path, string content)
        {
            var entry = zip.CreateEntry(path);
            using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
            writer.Write(content);
        }

        private static List<ImportarEnvioRow> ParseCsv(Stream stream)
        {
            using var reader = new StreamReader(stream, Encoding.UTF8, true);
            var lines = reader.ReadToEnd().Split('\n').Select(l => l.Trim('\r')).Where(l => l.Length > 0).ToList();
            if (lines.Count <= 1) return new List<ImportarEnvioRow>();
            var headers = SplitCsv(lines[0]);
            return lines.Skip(1)
                .Select((line, i) => ToRow(i + 2, headers, SplitCsv(line)))
                .Where(r => r is not null)
                .Cast<ImportarEnvioRow>()
                .ToList();
        }

        private static List<ImportarEnvioRow> ParseXlsx(Stream stream)
        {
            using var zip = new ZipArchive(stream, ZipArchiveMode.Read, true);
            var shared = ReadSharedStrings(zip);
            var sheet = zip.GetEntry("xl/worksheets/sheet1.xml") ?? throw new InvalidOperationException("El Excel no contiene la hoja esperada.");
            using var sheetStream = sheet.Open();
            var doc = XDocument.Load(sheetStream);
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var rows = doc.Descendants(ns + "row").ToList();
            if (rows.Count <= 1) return new List<ImportarEnvioRow>();
            var headers = ReadRow(rows[0], ns, shared);
            return rows.Skip(1)
                .Select(r => ToRow(int.TryParse(r.Attribute("r")?.Value, out var rowNum) ? rowNum : 0, headers, ReadRow(r, ns, shared)))
                .Where(r => r is not null)
                .Cast<ImportarEnvioRow>()
                .ToList();
        }

        private static List<string> ReadRow(XElement row, XNamespace ns, List<string> shared)
        {
            var cells = new SortedDictionary<int, string>();
            foreach (var cell in row.Elements(ns + "c"))
            {
                var refValue = cell.Attribute("r")?.Value ?? string.Empty;
                var col = ColumnIndex(new string(refValue.TakeWhile(char.IsLetter).ToArray()));
                var type = cell.Attribute("t")?.Value;
                var value = type switch
                {
                    "s" => int.TryParse(cell.Element(ns + "v")?.Value, out var idx) && idx >= 0 && idx < shared.Count ? shared[idx] : string.Empty,
                    "inlineStr" => cell.Descendants(ns + "t").FirstOrDefault()?.Value ?? string.Empty,
                    _ => cell.Element(ns + "v")?.Value ?? string.Empty,
                };
                cells[col] = value;
            }

            return Enumerable.Range(1, cells.Count == 0 ? 0 : cells.Keys.Max())
                .Select(i => cells.TryGetValue(i, out var value) ? value : string.Empty)
                .ToList();
        }

        private static List<string> ReadSharedStrings(ZipArchive zip)
        {
            var entry = zip.GetEntry("xl/sharedStrings.xml");
            if (entry is null) return new List<string>();
            using var stream = entry.Open();
            var doc = XDocument.Load(stream);
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            return doc.Descendants(ns + "si").Select(si => string.Concat(si.Descendants(ns + "t").Select(t => t.Value))).ToList();
        }

        private static int ColumnIndex(string letters)
        {
            var sum = 0;
            foreach (var c in letters.ToUpperInvariant())
                sum = sum * 26 + c - 'A' + 1;
            return sum;
        }

        private static List<string> SplitCsv(string line) => line.Split(';').Select(x => x.Trim().Trim('"')).ToList();

        private static ImportarEnvioRow? ToRow(int fila, List<string> headers, List<string> values)
        {
            if (values.All(string.IsNullOrWhiteSpace)) return null;
            if (fila == 2 && EsFilaGuiaSinCompletar(values))
                return null;
            string Get(string name)
            {
                var idx = headers.FindIndex(h => string.Equals(h, name, StringComparison.OrdinalIgnoreCase));
                return idx >= 0 && idx < values.Count ? values[idx].Trim() : string.Empty;
            }

            if (!double.TryParse(Get("Peso").Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var peso))
                peso = 0;

            Enum.TryParse<TipoEnvio>(Get("TipoEnvio"), true, out var tipoEnvio);
            Enum.TryParse<TipoPaquete>(Get("TipoPaquete"), true, out var tipoPaquete);
            var modalidad = Get("ModalidadEntrega");
            var esPickUp = modalidad.Equals("PickUp", StringComparison.OrdinalIgnoreCase)
                || modalidad.Equals("Pickup", StringComparison.OrdinalIgnoreCase)
                || (!modalidad.Equals("Domicilio", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(Get("PuntoPickUpId")));
            Guid? puntoPickUpId = esPickUp ? ExtraerGuid(Get("PuntoPickUpId")) : null;

            return new ImportarEnvioRow(fila, new RegistrarPaqueteRequest
            {
                Peso = peso,
                TipoEnvio = tipoEnvio,
                TipoPaquete = tipoPaquete,
                Comentarios = Get("Comentarios"),
                Remitente = new RegistrarClienteRequest
                {
                    Nombre = "Sucursal",
                    Apellido = "Origen",
                    Direccion = string.Empty,
                    Localidad = string.Empty,
                    CP = string.Empty,
                },
                Destinatario = new RegistrarClienteRequest
                {
                    Nombre = Get("DestinatarioNombre"),
                    Apellido = Get("DestinatarioApellido"),
                    Direccion = Get("DestinatarioDireccion"),
                    Localidad = Get("DestinatarioLocalidad"),
                    CP = Get("DestinatarioCP"),
                    Provincia = Get("DestinatarioProvincia"),
                    Telefono = Get("DestinatarioTelefono"),
                    Email = Get("DestinatarioEmail"),
                },
                PuntoPickUpId = puntoPickUpId,
            });
        }

        private static Guid? ExtraerGuid(string value)
        {
            if (Guid.TryParse(value, out var id)) return id;
            var match = Regex.Match(value, @"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
            return match.Success && Guid.TryParse(match.Value, out id) ? id : null;
        }

        private static bool EsFilaGuiaSinCompletar(List<string> values)
        {
            var placeholders = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Completar",
                "Elegir Domicilio/PickUp",
                "Solo si es PickUp",
                "Solo Domicilio",
                "Ej: 4.5",
                "Elegir",
                "Opcional"
            };
            return values.Where(v => !string.IsNullOrWhiteSpace(v)).All(v => placeholders.Contains(v.Trim()));
        }
    }
}
