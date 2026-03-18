<?php

declare(strict_types=1);

namespace App\Exceptions\Rewards;

use Symfony\Component\HttpKernel\Exception\HttpException;

class RedemptionException extends HttpException
{
    public static function notPending(): self
    {
        return new self(422, 'Solo se pueden procesar redenciones pendientes.');
    }

    public static function notApproved(): self
    {
        return new self(422, 'Solo se pueden completar redenciones aprobadas.');
    }

    public static function cannotCancel(): self
    {
        return new self(422, 'Solo se pueden cancelar redenciones pendientes o aprobadas.');
    }

    public static function cannotRedeem(string $reason): self
    {
        return new self(422, $reason);
    }
}
