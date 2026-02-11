'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { Registro } from '@/types';

export default function AdminRegistroDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function loadRegistro() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('registros')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (error || !data) {
        router.push('/admin/registros');
        return;
      }
      setRegistro(data as Registro);
      setLoading(false);
    }
    loadRegistro();
  }, [id, router]);

  async function handleSendEmail() {
    setActionLoading('email');
    setActionResult(null);
    try {
      const res = await fetch(`/api/pdf/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });
      const data = await res.json();
      if (data.emailSent) {
        setActionResult({ type: 'success', message: `Correo enviado a ${data.correoEnviado}` });
      } else {
        setActionResult({ type: 'error', message: data.emailError || 'No se pudo enviar el correo' });
      }
    } catch {
      setActionResult({ type: 'error', message: 'Error de conexión' });
    } finally {
      setActionLoading('');
    }
  }

  async function handleDelete() {
    if (!confirm('¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.')) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      setActionResult({ type: 'error', message: 'Error al eliminar: ' + error.message });
    } else {
      router.push('/admin/registros');
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  function formatDateTime(dateStr: string | null) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!registro) return null;

  const nombreCompleto = `${registro.nombre} ${registro.apellido_paterno} ${registro.apellido_materno}`;
  const whatsappLink = `https://wa.me/52${registro.telefono_celular}`;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <Link href="/admin/registros" className="text-sm text-gray-400 hover:text-primary transition-colors">
            ← Volver a registros
          </Link>
          <h1 className="text-2xl font-semibold text-gray-800 mt-1">
            Folio #{registro.id} — {nombreCompleto}
          </h1>
        </div>
      </div>

      {/* Action result */}
      {actionResult && (
        <div className={`mb-6 p-4 rounded-xl border-2 text-sm animate-[fadeIn_0.3s_ease]
          ${actionResult.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {actionResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Acciones</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/pdf/${id}`}
            target="_blank"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary-dark
              text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >
            📄 Ver PDF
          </a>

          <button
            onClick={handleSendEmail}
            disabled={actionLoading === 'email'}
            className="inline-flex items-center gap-2 bg-blue-500 text-white py-2.5 px-5 rounded-xl
              text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all
              disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {actionLoading === 'email' ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
            ) : (
              <>📧 Enviar Correo</>
            )}
          </button>

          <a
            href={whatsappLink}
            target="_blank"
            className="inline-flex items-center gap-2 bg-[#25d366] text-white py-2.5 px-5 rounded-xl
              text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >
            📱 WhatsApp
          </a>

          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 bg-red-500 text-white py-2.5 px-5 rounded-xl
              text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all ml-auto"
          >
            🗑️ Eliminar
          </button>
        </div>
      </div>

      {/* Datos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos Personales */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b border-gray-100">
            Datos Personales
          </h3>
          <dl className="space-y-3">
            <DataRow label="Nombre" value={nombreCompleto} />
            <DataRow label="Correo" value={registro.correo_electronico} />
            <DataRow label="Teléfono" value={registro.telefono_celular} />
            <DataRow label="Estado Civil" value={registro.estado_civil} />
            <DataRow label="Grado de Estudios" value={registro.grado_estudios} />
            <DataRow label="Fecha de Nacimiento" value={formatDate(registro.fecha_nacimiento)} />
            <DataRow label="País de Nacimiento" value={registro.pais_nacimiento} />
            <DataRow label="Estado de Nacimiento" value={registro.estado_nacimiento} />
            <DataRow label="Municipio de Nacimiento" value={registro.municipio_nacimiento} />
          </dl>
        </div>

        {/* Domicilio */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b border-gray-100">
            Domicilio
          </h3>
          <dl className="space-y-3">
            <DataRow label="Calle" value={`${registro.calle_domicilio} #${registro.numero_exterior}${registro.numero_interior ? ' Int. ' + registro.numero_interior : ''}`} />
            <DataRow label="Colonia" value={registro.colonia_domicilio} />
            <DataRow label="C.P." value={registro.codigo_postal} />
            <DataRow label="País" value={registro.pais_domicilio} />
            <DataRow label="Estado" value={registro.estado_domicilio} />
            <DataRow label="Municipio" value={registro.municipio_domicilio} />
          </dl>
        </div>

        {/* Contacto Familiar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b border-gray-100">
            Contacto Familiar
          </h3>
          <dl className="space-y-3">
            <DataRow label="Nombre" value={registro.familiar_nombre} />
            <DataRow label="Parentesco" value={registro.familiar_parentesco} />
            <DataRow label="Teléfono" value={registro.familiar_telefono} />
            <DataRow label="Dirección" value={`${registro.familiar_calle || ''} #${registro.familiar_numero || ''}, Col. ${registro.familiar_colonia || ''}`} />
            <DataRow label="C.P." value={registro.familiar_codigo_postal} />
            <DataRow label="Estado" value={registro.familiar_estado} />
            <DataRow label="Municipio" value={registro.familiar_municipio} />
          </dl>
        </div>

        {/* Contacto de Emergencia */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b border-gray-100">
            Contacto de Emergencia
          </h3>
          <dl className="space-y-3">
            <DataRow label="Nombre" value={registro.emergencia_nombre} />
            <DataRow label="Parentesco" value={registro.emergencia_parentesco} />
            <DataRow label="Teléfono" value={registro.emergencia_telefono} />
          </dl>
        </div>

        {/* Curso y Documentos */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 pb-3 border-b border-gray-100">
            Curso y Documentos
          </h3>
          <dl className="space-y-3">
            <DataRow label="Curso" value={registro.curso} />
            <DataRow label="Fecha de Registro" value={formatDateTime(registro.fecha_registro)} />
            <DataRow label="INE/CURP" value={registro.ruta_ine ? '✅ Documento subido' : '—'} />
            <DataRow label="Acta de Nacimiento" value={registro.ruta_acta_nacimiento ? '✅ Documento subido' : '—'} />
            <DataRow label="Comprobante de Domicilio" value={registro.ruta_comprobante_domicilio ? '✅ Documento subido' : '—'} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <dt className="text-sm text-gray-400 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-gray-800 font-medium text-right">{value || '—'}</dd>
    </div>
  );
}
