<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Money Loan Agreement — {{ $investment->numero_desembolso }}</title>
<style>
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; margin: 40px 50px; line-height: 1.7; color: #1a1a1a; }
    .titulo { text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border: 2px solid #1a1a1a; padding: 10px 20px; margin-bottom: 25px; }
    p { text-align: justify; margin-bottom: 12px; }
    .clausula-titulo { font-weight: bold; text-transform: uppercase; }
    .firma-section { margin-top: 60px; }
    .firma-col { display: table-cell; width: 50%; text-align: center; padding: 0 20px; }
    .firma-linea { border-top: 1px solid #1a1a1a; margin-top: 50px; margin-bottom: 6px; }
    .firma-nombre { font-weight: bold; font-size: 11px; }
    .firma-rol { font-size: 10px; font-style: italic; }
    .numero { font-style: italic; }
</style>
</head>
<body>

<div class="titulo">Money Loan Agreement</div>

<p>Between the parties:</p>

<p>
A) <strong>{{ strtoupper($investor->name) }}</strong>,
@if($investor->nacionalidad) {{ $investor->nacionalidad }} national, @endif
@if($investor->estado_civil) {{ $investor->estado_civil }}, @endif
@if($investor->profesion) {{ $investor->profesion }}, @endif
@if($investor->direccion_contrato) residing at: {{ $investor->direccion_contrato }}, @endif
@if($investor->cedula)
@if($investor->tipo_persona === 'Persona Jurídica') legal entity ID number: @else ID/Passport number: @endif <strong>{{ $investor->cedula }}</strong>,
@endif
hereinafter referred to as: <strong>"The Lender"</strong>
</p>

<p>
B) <strong>LEONARDO GÓMEZ SALAZAR</strong>, of legal age, married, Attorney and Notary, residing in San José, canton Central, district Mata Redonda, avenue eleven, house number five thousand six hundred thirty-five, national ID number: <strong>ONE-EIGHT HUNDRED SEVENTY-SIX-SIX HUNDRED SIXTY-FOUR</strong>, acting in his capacity as <strong>TREASURER</strong> with powers of <strong>GENERAL ATTORNEY-IN-FACT WITHOUT MONETARY LIMIT</strong>, of the company <strong>CREDIPEP SOCIEDAD ANÓNIMA</strong>, legal entity ID: Three-one hundred one-five hundred fifteen thousand five hundred eleven, domiciled in San José, Sabana Norte, hereinafter referred to as <strong>"The Borrower"</strong>.
</p>

<p>The parties agree to enter into this Money Loan Agreement, which shall be governed by the Commercial Code, the Civil Code, the legal framework of the Republic of Costa Rica, and the following clauses:</p>

<p><span class="clausula-titulo">First. Subject Matter:</span> "The Lender" grants as a <strong>LOAN</strong> to "The Borrower" the sum of
<strong>{{ $montoFormateado }}</strong>
(<span class="numero">{{ $montoEnPalabras }}</span>),
for which the company <strong>CREDIPEP SOCIEDAD ANÓNIMA</strong> assumes the debt obligation.
</p>

<p><span class="clausula-titulo">Second. Interest:</span> "The Borrower" shall recognize and pay on the aforementioned sum an annual interest rate of <strong>{{ $tasaFormateada }}%</strong> (<span class="numero">{{ $tasaEnPalabras }}</span>), to be paid on a <strong>{{ $formaPago }}</strong> basis. Both parties agree that there shall be NO late payment interest penalties.</p>

<p><span class="clausula-titulo">Third. Term and Place of Payment:</span> "The Borrower" shall repay "The Lender" the principal amount plus the corresponding interest, in a lump sum, within a term of <strong>{{ $plazoEnPalabras }}</strong>, beginning on <span class="numero">{{ $fechaInicioEnPalabras }}</span> and ending on <span class="numero">{{ $fechaVencimientoEnPalabras }}</span>. Payment shall be made to the bank account designated by "The Lender".</p>

<p><span class="clausula-titulo">Fourth:</span> "The Borrower" may make early payments, in full or in part, on the outstanding principal without incurring any commission, surcharge, penalty, or additional obligation. Early payments shall be applied directly to the principal balance of the loan and shall result in a corresponding reduction of future interest, in accordance with applicable legislation in the Republic of Costa Rica.</p>

<p><span class="clausula-titulo">Fifth. Default:</span> Failure to make timely payment or breach by "The Borrower" of any obligation or condition of this Agreement shall entitle "The Lender" to declare the obligation due and demand full repayment of the outstanding debt, including all accrued interest and expenses as of the date of settlement.</p>

<p><span class="clausula-titulo">Sixth:</span> In case of default by "The Borrower", and without prejudice to domicile waiver, for all purposes of any eventual judicial proceedings, "The Borrower" designates as contractual domicile the address indicated in this document where notice may be served personally or by official notification at the company's registered office. Both parties are likewise obligated to notify the other in writing of any change of address.</p>

<p><span class="clausula-titulo">Seventh:</span> "The Lender" may assign or transfer this Agreement or any of its attachments, or create a guarantee on such documents or rights, to one or more third parties without requiring authorization from "The Borrower", in accordance with Article 1104 and following of the Costa Rican Civil Code. "The Lender" commits to notify "The Borrower" prior to any such assignment or transfer.</p>

<p><span class="clausula-titulo">Eighth:</span> Both parties expressly agree to maintain strict confidentiality with respect to this Agreement and any technical and commercial information of either party arising from its performance. Both parties agree that they may, at any time, have this Agreement notarized to establish a certain date.</p>

<p><span class="clausula-titulo">Ninth:</span> If "The Lender" determines that "The Borrower" has provided false information, failed to comply with the investment plan, or breached any condition established herein, subject to due process, "The Lender" may demand the immediate cancellation of the outstanding balance.</p>

<p>In agreement, the parties sign this contract at eight o'clock on {{ $fechaFirmaEnPalabras }}.</p>

<div class="firma-section">
    <table class="firma-table" style="width:100%;">
        <tr>
            <td style="width:50%; text-align:center; padding: 0 30px;">
                <div class="firma-linea"></div>
                <div class="firma-nombre">{{ $investor->name }}</div>
                <div class="firma-rol">"The Lender"</div>
            </td>
            <td style="width:50%; text-align:center; padding: 0 30px;">
                <div class="firma-linea"></div>
                <div class="firma-nombre">Leonardo Gómez Salazar</div>
                <div class="firma-rol">"The Borrower"</div>
            </td>
        </tr>
    </table>
</div>

</body>
</html>
