<?php

namespace Tests\Feature;

use App\Models\Person;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PersonDocumentControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Configurar storage fake
        Storage::fake('public');

        // Crear usuario para autenticación
        $this->user = User::factory()->create();
    }

    /** @test */
    public function cannot_upload_document_for_person_without_cedula()
    {
        // Crear persona SIN cédula
        $person = Person::factory()->create([
            'name' => 'Juan Pérez',
            'cedula' => null,
            'person_type_id' => 1
        ]);

        $file = UploadedFile::fake()->create('documento.pdf', 100);

        $response = $this->actingAs($this->user)->postJson('/api/person-documents', [
            'person_id' => $person->id,
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'error' => 'La persona debe tener una cédula asignada para subir documentos.',
                'code' => 'PERSON_WITHOUT_CEDULA'
            ]);

        // Verificar que NO se creó el archivo
        Storage::disk('public')->assertMissing('documents/documento.pdf');
    }

    /** @test */
    public function can_upload_document_for_person_with_cedula()
    {
        // Crear persona CON cédula
        $person = Person::factory()->create([
            'name' => 'María González',
            'cedula' => '1-2345-6789',
            'person_type_id' => 1
        ]);

        $file = UploadedFile::fake()->create('documento.pdf', 100);

        $response = $this->actingAs($this->user)->postJson('/api/person-documents', [
            'person_id' => $person->id,
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'id',
                'person_id',
                'name',
                'path',
                'url',
                'mime_type',
                'size'
            ]);

        // Verificar que el archivo se guardó en la carpeta de la cédula
        $strippedCedula = '123456789';
        Storage::disk('public')->assertExists("documents/{$strippedCedula}/documento.pdf");
    }

    /** @test */
    public function organizes_files_by_cedula_folder()
    {
        $person = Person::factory()->create([
            'cedula' => '8-123-456',
            'person_type_id' => 1
        ]);

        $file = UploadedFile::fake()->create('test.pdf', 100);

        $response = $this->actingAs($this->user)->postJson('/api/person-documents', [
            'person_id' => $person->id,
            'file' => $file,
        ]);

        $response->assertStatus(201);

        // Verificar que el archivo está en documents/{cedula_sin_guiones}/
        Storage::disk('public')->assertExists('documents/8123456/test.pdf');

        // Verificar que NO está en la raíz de documents/
        Storage::disk('public')->assertMissing('documents/test.pdf');
    }

    /** @test */
    public function handles_file_name_collision_with_timestamp()
    {
        $person = Person::factory()->create([
            'cedula' => '1-1111-1111',
            'person_type_id' => 1
        ]);

        $strippedCedula = '111111111';

        // Crear archivo existente en el storage
        Storage::disk('public')->put("documents/{$strippedCedula}/documento.pdf", 'contenido antiguo');

        // Intentar subir archivo con el mismo nombre
        $file = UploadedFile::fake()->create('documento.pdf', 100);

        $response = $this->actingAs($this->user)->postJson('/api/person-documents', [
            'person_id' => $person->id,
            'file' => $file,
        ]);

        $response->assertStatus(201);

        // Verificar que existe el archivo original
        Storage::disk('public')->assertExists("documents/{$strippedCedula}/documento.pdf");

        // Verificar que se creó un nuevo archivo con timestamp
        $files = Storage::disk('public')->files("documents/{$strippedCedula}");

        $this->assertCount(2, $files, 'Deberían existir 2 archivos: el original y el nuevo con timestamp');

        // Verificar que hay un archivo con formato documento_YYYYMMDD_HHMMSS.pdf
        $timestampedFile = collect($files)->first(function ($file) {
            return preg_match('/documento_\d{8}_\d{6}\.pdf$/', $file);
        });

        $this->assertNotNull($timestampedFile, 'Debería existir un archivo con timestamp');
    }

    /** @test */
    public function normalizes_cedula_with_hyphens()
    {
        // Probar con diferentes formatos de cédula
        $formats = [
            '1-2345-6789',
            '12345-6789',
            '123456789'
        ];

        foreach ($formats as $cedula) {
            Storage::fake('public'); // Reset storage for each test

            $person = Person::factory()->create([
                'cedula' => $cedula,
                'person_type_id' => 1
            ]);

            $file = UploadedFile::fake()->create('test.pdf', 100);

            $response = $this->actingAs($this->user)->postJson('/api/person-documents', [
                'person_id' => $person->id,
                'file' => $file,
            ]);

            $response->assertStatus(201);

            // Todas deberían terminar en la misma carpeta normalizada
            Storage::disk('public')->assertExists('documents/123456789/test.pdf');
        }
    }

    /** @test */
    public function creates_cedula_folder_if_not_exists()
    {
        $person = Person::factory()->create([
            'cedula' => '9-9999-9999',
            'person_type_id' => 1
        ]);

        $strippedCedula = '999999999';

        // Verificar que la carpeta NO existe
        Storage::disk('public')->assertMissing("documents/{$strippedCedula}");

        $file = UploadedFile::fake()->create('nuevo.pdf', 100);

        $response = $this->actingAs($this->user)->postJson('/api/person-documents', [
            'person_id' => $person->id,
            'file' => $file,
        ]);

        $response->assertStatus(201);

        // Verificar que la carpeta fue creada y contiene el archivo
        Storage::disk('public')->assertExists("documents/{$strippedCedula}/nuevo.pdf");
    }

    /** @test */
    public function validates_person_id_exists()
    {
        $file = UploadedFile::fake()->create('test.pdf', 100);

        $response = $this->actingAs($this->user)->postJson('/api/person-documents', [
            'person_id' => 99999, // ID que no existe
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['person_id']);
    }

    /** @test */
    public function validates_file_is_required()
    {
        $person = Person::factory()->create([
            'cedula' => '1-1111-1111',
            'person_type_id' => 1
        ]);

        $response = $this->actingAs($this->user)->postJson('/api/person-documents', [
            'person_id' => $person->id,
            // Sin archivo
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    /** @test */
    public function validates_file_max_size()
    {
        $person = Person::factory()->create([
            'cedula' => '1-1111-1111',
            'person_type_id' => 1
        ]);

        // Archivo de 11MB (excede el límite de 10MB)
        $file = UploadedFile::fake()->create('huge.pdf', 11 * 1024);

        $response = $this->actingAs($this->user)->postJson('/api/person-documents', [
            'person_id' => $person->id,
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }
}
