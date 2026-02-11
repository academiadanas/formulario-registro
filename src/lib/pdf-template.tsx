import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from '@react-pdf/renderer';
import { Registro } from '@/types';
import { ACADEMIA_INFO } from '@/lib/constants';

// Estilos del PDF
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333333',
  },
  // Header
  header: {
    textAlign: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#d22c64',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 20,
  },
  // Sección
  sectionHeader: {
    backgroundColor: '#e74a82',
    padding: 8,
    marginBottom: 0,
    marginTop: 15,
  },
  sectionHeaderText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  // Tabla
  table: {
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    borderBottom: '1 solid #e0e0e0',
  },
  labelCell: {
    width: '35%',
    padding: 7,
    backgroundColor: '#fef0f5',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  valueCell: {
    width: '65%',
    padding: 7,
    fontSize: 9,
  },
  // Declaraciones
  declarationsSection: {
    marginTop: 25,
    paddingTop: 15,
    borderTop: '2 solid #e74a82',
  },
  declarationsTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    marginBottom: 10,
  },
  declarationsText: {
    fontSize: 9,
    lineHeight: 1.6,
    color: '#555555',
    marginBottom: 10,
  },
  link: {
    color: '#e74a82',
    textDecoration: 'none',
  },
  // Firma
  signatureSection: {
    marginTop: 40,
    alignItems: 'center',
  },
  signatureLine: {
    width: 250,
    borderBottom: '1 solid #333333',
    marginBottom: 5,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#666666',
  },
  // Nota final
  note: {
    marginTop: 30,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderLeft: '3 solid #e74a82',
    borderRadius: 2,
  },
  noteText: {
    fontSize: 8,
    color: '#666666',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
    borderTop: '1 solid #e0e0e0',
    paddingTop: 10,
  },
});

// Helpers
function formatFechaNacimiento(fecha: string): string {
  if (!fecha) return '';
  try {
    const date = new Date(fecha + 'T00:00:00');
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
}

function formatFechaRegistro(fecha: string): string {
  if (!fecha) return '';
  try {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return fecha;
  }
}

function buildDomicilio(registro: Registro): string {
  let domicilio = (registro.calle_domicilio || '') + ' #' + (registro.numero_exterior || '');
  if (registro.numero_interior) domicilio += ' Int. ' + registro.numero_interior;
  domicilio += ', Col. ' + (registro.colonia_domicilio || '');
  domicilio += ', C.P. ' + (registro.codigo_postal || '');
  domicilio += ', ' + (registro.municipio_domicilio || '') + ', ' + (registro.estado_domicilio || '');
  if (registro.pais_domicilio && registro.pais_domicilio !== 'MEXICO') {
    domicilio += ', ' + registro.pais_domicilio;
  }
  return domicilio;
}

function buildLugarNacimiento(registro: Registro): string {
  if (registro.pais_nacimiento === 'MEXICO') {
    return (registro.municipio_nacimiento || '') + ', ' + (registro.estado_nacimiento || '');
  } else if (registro.pais_nacimiento === 'ESTADOS UNIDOS') {
    return (registro.estado_nacimiento || '') + ', ESTADOS UNIDOS';
  } else {
    return (registro.lugar_nacimiento || '') + ', ' + (registro.pais_nacimiento || '');
  }
}

// Fila de tabla
function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.labelCell}>{label}</Text>
      <Text style={styles.valueCell}>{value || '—'}</Text>
    </View>
  );
}

// Componente principal del PDF
interface ComprobantePDFProps {
  registro: Registro;
}

export function ComprobantePDF({ registro }: ComprobantePDFProps) {
  const nombreCompleto = `${registro.nombre} ${registro.apellido_paterno} ${registro.apellido_materno}`.trim();

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Comprobante de Inscripción y Carta Compromiso</Text>
          <Text style={styles.subtitle}>{ACADEMIA_INFO.nombre}</Text>
        </View>

        {/* Información del Registro */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Información del Registro</Text>
        </View>
        <View style={styles.table}>
          <TableRow label="Folio de Registro:" value={String(registro.id)} />
          <TableRow label="Fecha de Registro:" value={formatFechaRegistro(registro.fecha_registro)} />
          <TableRow label="Curso de Interés:" value={registro.curso || ''} />
        </View>

        {/* Datos Personales */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Datos Personales</Text>
        </View>
        <View style={styles.table}>
          <TableRow label="Nombre Completo:" value={nombreCompleto} />
          <TableRow label="Correo Electrónico:" value={registro.correo_electronico || ''} />
          <TableRow label="Teléfono Celular:" value={registro.telefono_celular || ''} />
          <TableRow label="Fecha de Nacimiento:" value={formatFechaNacimiento(registro.fecha_nacimiento)} />
          <TableRow label="Lugar de Nacimiento:" value={buildLugarNacimiento(registro)} />
          <TableRow label="Estado Civil:" value={registro.estado_civil || ''} />
          <TableRow label="Último Grado Estudios:" value={registro.grado_estudios || ''} />
        </View>

        {/* Domicilio Registrado */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Domicilio Registrado</Text>
        </View>
        <View style={styles.table}>
          <TableRow label="Dirección Completa:" value={buildDomicilio(registro)} />
        </View>

        {/* Declaraciones */}
        <View style={styles.declarationsSection}>
          <Text style={styles.declarationsTitle}>
            DECLARACIONES Y COMPROMISOS DEL ESTUDIANTE
          </Text>
          <Text style={styles.declarationsText}>
            Al firmar este documento, declaro haber leído y aceptado las siguientes disposiciones
            del Reglamento General de Alumnos de Academia Danas:{' '}
            <Link src={ACADEMIA_INFO.reglamento} style={styles.link}>
              {ACADEMIA_INFO.reglamento}
            </Link>
          </Text>
        </View>

        {/* Firma */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Firma del estudiante</Text>
        </View>

        {/* Nota */}
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Nota Importante: Este documento es un comprobante electrónico de la recepción de tu
            solicitud de inscripción en Academia Danas. La inscripción formal está sujeta a la
            validación de los documentos y al proceso interno de la academia. Nos pondremos en
            contacto contigo a la brevedad para informarte sobre los siguientes pasos. Conserva
            este comprobante.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{ACADEMIA_INFO.nombre} — {ACADEMIA_INFO.direccion}</Text>
          <Text>{ACADEMIA_INFO.website}</Text>
        </View>
      </Page>
    </Document>
  );
}
