<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class QuoteMail extends Mailable
{
    use Queueable, SerializesModels;

    public $quoteData;

    /**
     * Create a new message instance.
     */
    public function __construct(array $quoteData)
    {
        $this->quoteData = $quoteData;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Cotización de Crédito - ' . ($this->quoteData['credit_type'] === 'regular' ? 'Crédito Regular' : 'Micro-crédito'),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.quote',
            with: [
                'leadName' => $this->quoteData['lead_name'],
                'amount' => $this->quoteData['amount'],
                'rate' => $this->quoteData['rate'],
                'term' => $this->quoteData['term'],
                'monthlyPayment' => $this->quoteData['monthly_payment'],
                'creditType' => $this->quoteData['credit_type'] === 'regular' ? 'Crédito Regular' : 'Micro-crédito',
            ],
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
