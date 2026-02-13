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

// Estilos del PDF - Diseño profesional con logo y footer
const styles = StyleSheet.create({
    page: {
        padding: 50,
        paddingBottom: 80,
        fontSize: 10,
        fontFamily: "Helvetica",
        color: "#333333",
    },
    // Header con logo
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 30,
    },
    logoContainer: {
        width: 80,
        marginRight: 20,
    },
    logo: {
        width: 80,
        height: 80,
        objectFit: "contain",
    },
    headerTextContainer: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontFamily: "Helvetica-Bold",
        color: "#333333",
        marginBottom: 3,
    },
    subtitle: {
        fontSize: 12,
        color: "#666666",
    },
    // Sección con línea inferior
    sectionHeader: {
        borderBottom: "2 solid #8B7355",
        paddingBottom: 4,
        marginBottom: 12,
        marginTop: 20,
    },
    sectionHeaderText: {
        fontSize: 11,
        fontFamily: "Helvetica-Bold",
        color: "#333333",
        textDecoration: "underline",
    },
    // Filas de datos
    dataRow: {
        flexDirection: "row",
        marginBottom: 8,
        paddingLeft: 10,
    },
    label: {
        width: "35%",
        fontSize: 10,
        color: "#555555",
    },
    value: {
        width: "65%",
        fontSize: 10,
        color: "#333333",
    },
    // Declaraciones
    declarationsSection: {
        marginTop: 30,
        paddingTop: 15,
        borderTop: "1 solid #cccccc",
        alignItems: "center",
    },
    declarationsTitle: {
        fontSize: 11,
        fontFamily: "Helvetica-Bold",
        color: "#333333",
        marginBottom: 8,
        textAlign: "center",
    },
    declarationsText: {
        fontSize: 9,
        lineHeight: 1.6,
        color: "#555555",
        marginBottom: 10,
        textAlign: "center",
    },
    link: {
        color: "#1a73e8",
        textDecoration: "none",
    },
    // Firma
    signatureSection: {
        marginTop: 50,
        alignItems: "center",
    },
    signatureLine: {
        width: 250,
        borderBottom: "1 solid #333333",
        marginBottom: 5,
    },
    signatureLabel: {
        fontSize: 9,
        color: "#666666",
    },
    // Nota final
    note: {
        marginTop: 30,
        paddingTop: 10,
    },
    noteText: {
        fontSize: 7.5,
        color: "#888888",
        lineHeight: 1.5,
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
    footerTop: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 5,
        gap: 25,
    },
    footerItem: {
        flexDirection: "row",
        alignItems: "center",
    },
    footerIcon: {
        fontSize: 8,
        color: "#666666",
        marginRight: 3,
    },
    footerText: {
        fontSize: 7.5,
        color: "#666666",
    },
    footerBottom: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
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
            <Text style={styles.value}>{value || "—"}</Text>
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
                    <View style={styles.logoContainer}>
                        <Image style={styles.logo} src={ACADEMIA_INFO.logo} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.title}>
                            Comprobante de Inscripción y Carta Compromiso
                        </Text>
                        <Text style={styles.subtitle}>
                            {ACADEMIA_INFO.nombre}
                        </Text>
                    </View>
                </View>

                {/* Información del Registro */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>
                        Información del Registro
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
                        label="Curso de Interés:"
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
                        label="Correo Electrónico:"
                        value={registro.correo_electronico || ""}
                    />
                    <DataRow
                        label="Teléfono Celular:"
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
                        label="Último Grado Estudios:"
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
                        label="Dirección Completa:"
                        value={buildDomicilio(registro)}
                    />
                </View>

                {/* Declaraciones */}
                <View style={styles.declarationsSection}>
                    <Text style={styles.declarationsTitle}>
                        DECLARACIONES Y COMPROMISOS DEL ESTUDIANTE
                    </Text>
                    <Text style={styles.declarationsText}>
                        Al firmar este documento, declaro haber leído y aceptado
                        las siguientes disposiciones del Reglamento General de
                        Alumnos de Academia Danas:{" "}
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
                        Nota Importante: Este documento es un comprobante
                        electrónico de la recepción de tu solicitud de
                        inscripción en Academia Danas. La inscripción formal
                        está sujeta a la validación de los documentos y al
                        proceso interno de la academia. Nos pondremos en
                        contacto contigo a la brevedad para informarte sobre los
                        siguientes pasos. Conserva este comprobante.
                    </Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.footerTop}>
                        <View style={styles.footerItem}>
                            <Text style={styles.footerIcon}>✆</Text>
                            <Text style={styles.footerText}>
                                {ACADEMIA_INFO.telefono}
                            </Text>
                        </View>
                        <View style={styles.footerItem}>
                            <Text style={styles.footerIcon}>f</Text>
                            <Text style={styles.footerText}>academiadanas</Text>
                        </View>
                        <View style={styles.footerItem}>
                            <Text style={styles.footerIcon}>◉</Text>
                            <Text style={styles.footerText}>
                                academia_danas
                            </Text>
                        </View>
                        <View style={styles.footerItem}>
                            <Text style={styles.footerIcon}>✉</Text>
                            <Text style={styles.footerText}>
                                {ACADEMIA_INFO.correo}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.footerBottom}>
                        <Text style={styles.footerAddress}>
                            ● {ACADEMIA_INFO.direccion}
                        </Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}
