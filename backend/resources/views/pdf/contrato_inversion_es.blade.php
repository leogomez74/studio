<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Contrato de Préstamo de Dinero — {{ $investment->numero_desembolso }}</title>
<style>
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; margin: 40px 50px; line-height: 1.7; color: #1a1a1a; }
    .titulo { text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border: 2px solid #1a1a1a; padding: 10px 20px; margin-bottom: 25px; }
    p { text-align: justify; margin-bottom: 12px; }
    .clausula-titulo { font-weight: bold; text-transform: uppercase; }
    .firma-section { margin-top: 60px; }
    .firma-table { width: 100%; }
    .firma-col { display: table-cell; width: 50%; text-align: center; padding: 0 20px; }
    .firma-linea { border-top: 1px solid #1a1a1a; margin-top: 50px; margin-bottom: 6px; }
    .firma-nombre { font-weight: bold; font-size: 11px; }
    .firma-rol { font-size: 10px; font-style: italic; }
    .numero { font-style: italic; }
</style>
</head>
<body>

<div class="titulo">Contrato de Préstamo de Dinero</div>

<p>Entre nosotros;</p>

<p>
A) <strong>{{ strtoupper($investor->name) }}</strong>,
@if($nacionalidad) {{ $nacionalidad }}, @endif
@if($estadoCivil) {{ $estadoCivil }}, @endif
@if($profesion) {{ $profesion }}, @endif
@if($direccion) vecino de: {{ $direccion }}, @endif
@if($investor->cedula)
@if($investor->tipo_persona === 'Persona Jurídica') cédula jurídica número: @else portador de la cédula número: @endif <strong>{{ $idEnPalabras }}</strong>,
@endif
en adelante conocido como: <strong>"El Prestamista"</strong>
</p>

<p>
B) <strong>LEONARDO GÓMEZ SALAZAR</strong>, mayor, casado en primeras nupcias, Abogado y Notario, vecino de: San José, cantón: Central, distrito: Mata Redonda, avenida once, casa número: cinco mil seiscientos treinta y cinco, portador de la cédula de identidad número: <strong>UNO- OCHOCIENTOS SETENTA Y SEIS- SEISCIENTOS SESENTA Y CUATRO</strong>, actuando en su condición de <strong>TESORERO</strong> con facultades <strong>APODERADO GENERALÍSIMO SIN LIMITE DE SUMA</strong>, de la sociedad <strong>{{ $credipepDesc }}</strong>, quien en adelante y para los efectos del presente Contrato será referido como <strong>"El Deudor"</strong>.
</p>

<p>Las partes convenimos en celebrar el presente Contrato de Préstamo de Dinero, el cual se regirá por lo establecido en el Código de Comercio, Código Civil, el ordenamiento jurídico de la República de Costa Rica, y por lo indicado en las siguientes cláusulas:</p>

<p><span class="clausula-titulo">Primera. Objeto:</span> "El Prestamista" otorga en calidad de <strong>PRÉSTAMO</strong> a "El Deudor" la suma de
<strong>{{ $montoFormateado }}</strong>
(<span class="numero">{{ $montoEnPalabras }}</span>),
monto de dinero por el cual la empresa <strong>CREDIPEP SOCIEDAD ANÓNIMA</strong> se constituye en deudora.
</p>

<p><span class="clausula-titulo">Segunda. Intereses:</span> "El Deudor" reconocerá y pagará por la suma anteriormente indicada, intereses corrientes del <strong>{{ $tasaFormateada }}%</strong> (<span class="numero">{{ $tasaEnPalabras }}</span>) de forma anual, los cuales serán cancelados de forma <strong>{{ $formaPago }}</strong>. Convienen ambas partes, que NO habrá porcentaje de intereses moratorios.</p>

<p><span class="clausula-titulo">Tercera. Plazo y Lugar de Pago:</span> "El Deudor" pagará en un solo tracto a "El Prestamista" el monto capital, más sus respectivos intereses, en el plazo de <strong>{{ $plazoEnPalabras }}</strong>. Plazo que inicia el día <span class="numero">{{ $fechaInicioEnPalabras }}</span> y termina el día <span class="numero">{{ $fechaVencimientoEnPalabras }}</span>. "El Deudor" realizará el pago en la cuenta bancaria que "El Prestamista" le indique para su cumplimiento.</p>

<p><span class="clausula-titulo">Cuarta:</span> "El Deudor" podrá realizar pagos anticipados, totales o parciales, al capital adeudado, sin que dichos pagos generen comisión, recargo, penalidad u obligación adicional alguna. Los pagos anticipados se aplicarán directamente al saldo principal del crédito y producirán la correspondiente reducción de intereses futuros, de conformidad con la legislación aplicable en la República de Costa Rica.</p>

<p><span class="clausula-titulo">Quinta. Incumplimiento:</span> La falta de pago oportuno estipulado o el incumplimiento por parte de "El Deudor" de cualquiera de las obligaciones o condiciones de este contrato, facultará a "El Prestamista" para tener por vencida la obligación y por exigible la cancelación total de la deuda, así como los intereses y demás gastos que se adeudaren a la fecha de la liquidación.</p>

<p><span class="clausula-titulo">Sexta:</span> En caso de incumplimiento de "El Deudor" y sin perjuicio de la renuncia del domicilio, para todos los efectos de un eventual proceso judicial, "El Deudor" señala como domicilio contractual la dirección que ha indicado en este documento en el cual se puede notificar personalmente o por medio de cédula en el domicilio de la sociedad. Asimismo se obliga a ambas partes notificar por escrito de cualquier cambio de su domicilio.</p>

<p><span class="clausula-titulo">Séptima:</span> "El Prestamista" podrá ceder o transferir el presente contrato o cualquiera de sus anexos o constituir garantía sobre dichos documentos o derechos a uno o más terceros, sin necesidad de autorización de "El Deudor", de acuerdo con lo establecido por el artículo mil ciento cuatro y siguientes del Código Civil costarricense. "El Prestamista" se compromete a comunicar previamente a "El Deudor" la cesión o transferencia del presente contrato.</p>

<p><span class="clausula-titulo">Octava:</span> Ambas partes se comprometen expresamente a mantener bajo estricta confidencialidad el presente contrato, así como la información técnica y comercial de ambas partes que se deriven de su cumplimiento. Ambas partes acuerdan que pueden llevar en cualquier momento este contrato ante un notario a darle fecha cierta.</p>

<p><span class="clausula-titulo">Novena:</span> Si "El Prestamista" comprueba que "El Deudor" ha suministrado información falsa, incumplido el plan de inversión o cualquiera de las condiciones establecidas en la contratación del préstamo, previo debido proceso, podrá exigir la cancelación inmediata de su saldo.</p>

<p>Estando las partes de acuerdo, firmamos el presente contrato a las ocho horas del {{ $fechaFirmaEnPalabras }}.</p>

<div class="firma-section">
    <table class="firma-table">
        <tr>
            <td class="firma-col" style="width:50%; text-align:center; padding: 0 30px;">
                <div class="firma-linea"></div>
                <div class="firma-nombre">{{ $investor->name }}</div>
                <div class="firma-rol">"El Prestamista"</div>
            </td>
            <td class="firma-col" style="width:50%; text-align:center; padding: 0 30px;">
                <div class="firma-linea"></div>
                <div class="firma-nombre">Leonardo Gómez Salazar</div>
                <div class="firma-rol">"El Deudor"</div>
            </td>
        </tr>
    </table>
</div>

</body>
</html>
