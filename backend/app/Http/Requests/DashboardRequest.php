<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class DashboardRequest extends FormRequest
{
    public function authorize(): bool
    {
        if (in_array($this->input('mode'), ['sikn', 'dev'], true)) {
            return app()->environment(['local', 'testing'])
                && in_array($this->ip(), ['127.0.0.1', '::1'], true);
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'mode' => ['sometimes', 'required', Rule::in(['pilot', 'excel', 'demo', 'sikn', 'dev'])],
            'provinceId' => ['sometimes', 'required', 'string', 'regex:/^\d{2}$/'],
            'kabKotaId' => ['sometimes', 'required', 'string', 'regex:/^\d{2}\.\d{2}$/'],
            'jenisId' => ['sometimes', 'required', 'string', 'max:80'],
            'search' => ['sometimes', 'nullable', 'string', 'max:150'],
            'page' => ['sometimes', 'required', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['sometimes', 'required', 'integer', 'min:1', 'max:250'],
        ];
    }

    public function mode(): string
    {
        return $this->validated('mode', config('dashboard.default_mode'));
    }

    public function messages(): array
    {
        return ['mode.in' => 'Mode harus pilot, excel, demo, sikn, atau dev (uji lokal).', 'kabKotaId.regex' => 'Kode kabupaten/kota tidak valid.', 'provinceId.regex' => 'Kode provinsi tidak valid.'];
    }
}
