import React from "react";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Link,
    Image,
} from "@react-pdf/renderer";
import { Registro } from "@/types";
import { ACADEMIA_INFO } from "@/lib/constants";

// Estilos del PDF - Diseño profesional
const styles = StyleSheet.create({
    page: {
        padding: 50,
        paddingBottom: 75,
        fontSize: 10,
        fontFamily: "Helvetica",
        color: "#333333",
    },
    // Header con logo
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 25,
    },
    logo: {
        width: 100,
        height: 100,
        objectFit: "contain",
        marginRight: 25,
    },
    headerTextContainer: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontFamily: "Helvetica-Bold",
        color: "#333333",
        marginBottom: 3,
    },
    subtitle: {
        fontSize: 11,
        color: "#666666",
    },
    // Encabezado de secci\u00f3n con fondo sombreado
    sectionHeader: {
        backgroundColor: "#f2f2f2",
        borderBottom: "1 solid #cccccc",
        padding: 6,
        paddingLeft: 10,
        marginBottom: 10,
        marginTop: 14,
    },
    sectionHeaderText: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        color: "#333333",
        textDecoration: "underline",
    },
    // Filas de datos
    dataRow: {
        flexDirection: "row",
        marginBottom: 6,
        paddingLeft: 15,
    },
    label: {
        width: "30%",
        fontSize: 9.5,
        color: "#555555",
    },
    value: {
        width: "70%",
        fontSize: 9.5,
        color: "#333333",
    },
    // Declaraciones
    declarationsSection: {
        marginTop: 20,
        alignItems: "center",
    },
    declarationsTitle: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        color: "#333333",
        marginBottom: 6,
        textAlign: "center",
    },
    declarationsText: {
        fontSize: 8.5,
        lineHeight: 1.5,
        color: "#555555",
        textAlign: "center",
    },
    link: {
        color: "#1a73e8",
        textDecoration: "none",
    },
    // Firma
    signatureSection: {
        marginTop: 40,
        alignItems: "center",
    },
    signatureLine: {
        width: 220,
        borderBottom: "1 solid #333333",
        marginBottom: 5,
    },
    signatureLabel: {
        fontSize: 9,
        color: "#666666",
    },
    // Nota final
    note: {
        marginTop: 20,
    },
    noteText: {
        fontSize: 7,
        color: "#888888",
        lineHeight: 1.4,
        fontStyle: "italic",
    },
    // Footer
    footer: {
        position: "absolute",
        bottom: 25,
        left: 50,
        right: 50,
        borderTop: "1 solid #dddddd",
        paddingTop: 8,
    },
    footerRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 4,
    },
    footerItem: {
        fontSize: 7.5,
        color: "#666666",
        marginLeft: 8,
        marginRight: 8,
    },
    footerAddress: {
        fontSize: 7.5,
        color: "#666666",
        textAlign: "center",
    },
});

// Helpers
function formatFechaNacimiento(fecha: string): string {
    if (!fecha) return "";
    try {
        const date = new Date(fecha + "T00:00:00");
        return date.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return fecha;
    }
}

function formatFechaRegistro(fecha: string): string {
    if (!fecha) return "";
    try {
        const date = new Date(fecha);
        return date.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    } catch {
        return fecha;
    }
}

function buildDomicilio(registro: Registro): string {
    let domicilio =
        (registro.calle_domicilio || "") +
        " #" +
        (registro.numero_exterior || "");
    if (registro.numero_interior)
        domicilio += " Int. " + registro.numero_interior;
    domicilio += ", Col. " + (registro.colonia_domicilio || "");
    domicilio += ", C.P. " + (registro.codigo_postal || "");
    domicilio +=
        ", " +
        (registro.municipio_domicilio || "") +
        ", " +
        (registro.estado_domicilio || "");
    if (registro.pais_domicilio && registro.pais_domicilio !== "MEXICO") {
        domicilio += ", " + registro.pais_domicilio;
    }
    return domicilio;
}

function buildLugarNacimiento(registro: Registro): string {
    if (registro.pais_nacimiento === "MEXICO") {
        return (
            (registro.municipio_nacimiento || "") +
            ", " +
            (registro.estado_nacimiento || "")
        );
    } else if (registro.pais_nacimiento === "ESTADOS UNIDOS") {
        return (registro.estado_nacimiento || "") + ", ESTADOS UNIDOS";
    } else {
        return (
            (registro.lugar_nacimiento || "") +
            ", " +
            (registro.pais_nacimiento || "")
        );
    }
}

// Fila de datos
function DataRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.dataRow}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value || "\u2014"}</Text>
        </View>
    );
}

// Componente principal del PDF
interface ComprobantePDFProps {
    registro: Registro;
}

export function ComprobantePDF({ registro }: ComprobantePDFProps) {
    const nombreCompleto =
        `${registro.nombre} ${registro.apellido_paterno} ${registro.apellido_materno}`.trim();

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {/* Header con Logo */}
                <View style={styles.header}>
                    <Image style={styles.logo} src={ACADEMIA_INFO.logo} />
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.title}>
                            Comprobante de Inscripci{"\u00f3"}n y Carta
                            Compromiso
                        </Text>
                        <Text style={styles.subtitle}>
                            {ACADEMIA_INFO.nombre}
                        </Text>
                    </View>
                </View>

                {/* Informacion del Registro */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>
                        Informaci{"\u00f3"}n del Registro
                    </Text>
                </View>
                <View>
                    <DataRow
                        label="Folio de Registro:"
                        value={String(registro.id)}
                    />
                    <DataRow
                        label="Fecha de Registro:"
                        value={formatFechaRegistro(registro.fecha_registro)}
                    />
                    <DataRow
                        label={`Curso de Inter${"\u00e9"}s:`}
                        value={registro.curso || ""}
                    />
                </View>

                {/* Datos Personales */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>
                        Datos Personales
                    </Text>
                </View>
                <View>
                    <DataRow label="Nombre Completo:" value={nombreCompleto} />
                    <DataRow
                        label={`Correo Electr${"\u00f3"}nico:`}
                        value={registro.correo_electronico || ""}
                    />
                    <DataRow
                        label={`Tel${"\u00e9"}fono Celular:`}
                        value={registro.telefono_celular || ""}
                    />
                    <DataRow
                        label="Fecha de Nacimiento:"
                        value={formatFechaNacimiento(registro.fecha_nacimiento)}
                    />
                    <DataRow
                        label="Lugar de Nacimiento:"
                        value={buildLugarNacimiento(registro)}
                    />
                    <DataRow
                        label="Estado Civil:"
                        value={registro.estado_civil || ""}
                    />
                    <DataRow
                        label={`${"\u00da"}ltimo Grado Estudios:`}
                        value={registro.grado_estudios || ""}
                    />
                </View>

                {/* Domicilio Registrado */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>
                        Domicilio Registrado
                    </Text>
                </View>
                <View>
                    <DataRow
                        label={`Direcci${"\u00f3"}n Completa:`}
                        value={buildDomicilio(registro)}
                    />
                </View>

                {/* Declaraciones */}
                <View style={styles.declarationsSection}>
                    <Text style={styles.declarationsTitle}>
                        DECLARACIONES Y COMPROMISOS DEL ESTUDIANTE
                    </Text>
                    <Text style={styles.declarationsText}>
                        Al firmar este documento, declaro haber le{"\u00ed"}do y
                        aceptado las siguientes disposiciones del Reglamento
                        General de Alumnos de Academia Danas:{" "}
                        <Link
                            src={ACADEMIA_INFO.reglamento}
                            style={styles.link}
                        >
                            {ACADEMIA_INFO.reglamento}
                        </Link>
                    </Text>
                </View>

                {/* Firma */}
                <View style={styles.signatureSection}>
                    <View style={styles.signatureLine} />
                    <Text style={styles.signatureLabel}>
                        Firma del estudiante
                    </Text>
                </View>

                {/* Nota */}
                <View style={styles.note}>
                    <Text style={styles.noteText}>
                        Nota Importante: Este documento es un comprobante electr
                        {"\u00f3"}nico de la recepci{"\u00f3"}n de tu solicitud
                        de inscripci{"\u00f3"}n en Academia Danas. La inscripci
                        {"\u00f3"}n formal est{"\u00e1"} sujeta a la validaci
                        {"\u00f3"}n de los documentos y al proceso interno de la
                        academia. Nos pondremos en contacto contigo a la
                        brevedad para informarte sobre los siguientes pasos.
                        Conserva este comprobante.
                    </Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.footerRow}>
                        <Text style={styles.footerItem}>
                            {"\u260e"} {ACADEMIA_INFO.telefono}
                        </Text>
                        <Text style={styles.footerItem}>f academiadanas</Text>
                        <Text style={styles.footerItem}>
                            {"\u25cb"} academia_danas
                        </Text>
                        <Text style={styles.footerItem}>
                            {"\u2709"} {ACADEMIA_INFO.correo}
                        </Text>
                    </View>
                    <View style={styles.footerRow}>
                        <Text style={styles.footerAddress}>
                            {"\u25cf"} {ACADEMIA_INFO.direccion}
                        </Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}
