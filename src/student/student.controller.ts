import { Controller, Get, Body, Patch, Param, Query } from '@nestjs/common';
import { StudentService } from './student.service';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateBiometricDto } from './dto/update-biometric.dto';

@Controller('student')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  /**
   * GET /student
   * Listar estudiantes con búsqueda opcional (código, email, nombre) y paginación.
   * @returns { data, total, page, limit }
   */
  @Get()
  async getStudents(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.studentService.findAllStudents({
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * GET /student/:email
   * Obtener estudiante por email
   * @param email El email del estudiante.
   * @returns La información del estudiante asociado al email.
   */
  @Get(':email')
  async getStudentByEmail(@Param('email') email: string) {
    return this.studentService.getStudentByEmail(email);
  }

  /**
   * GET /student/code/:student_code
   * Obtener estudiante por código de estudiante
   * @param student_id El código del estudiante.
   * @return La información del estudiante asociado al código.
   */
  @Get('code/:student_code')
  async getStudentById(@Param('student_code') student_code: string) {
    return this.studentService.getStudentByCode(student_code);
  }

  /**
   * GET /student/id/:student_id
   * Obtener estudiante por su identificador (uuid).
   * @param student_id El ID del estudiante.
   * @returns La información del estudiante con su perfil biométrico.
   */
  @Get('id/:student_id')
  async getStudentByStudentId(@Param('student_id') student_id: string) {
    return this.studentService.findById(student_id);
  }

  /**
   * PATCH /student/biometric/validate
   * Actualizar perfil biométrico del estudiante
   * @param updateBiometricDto Objeto con los datos para actualizar el perfil biométrico.
   * @returns Mensaje de confirmación.
   */
  @Patch('biometric/validate')
  async updateBiometric(@Body() updateBiometricDto: UpdateBiometricDto) {
    return this.studentService.updateBiometricProfile(updateBiometricDto);
  }

  /**
   * GET /student/biometric/status/:student_id
   * Obtener estado del perfil biométrico del estudiante
   * @param student_id El ID del estudiante.
   * @returns Estado del perfil biométrico.
   */
  @Get('biometric/status/:student_id')
  async getBiometricStatus(@Param('student_id') student_id: string) {
    return this.studentService.getBiometricStatus(student_id);
  }

  /**
   * PATCH /student/biometric/reset/:student_id
   * Resetear perfil biométrico del estudiante
   * @param student_id El ID del estudiante.
   * @returns Mensaje de confirmación.
   */
  @Patch('biometric/reset/:student_id')
  async resetBiometricProfile(@Param('student_id') student_id: string) {
    return this.studentService.resetBiometricProfile(student_id);
  }

  /**
   * PATH /student/:id
   * Actualizar información del estudiante
   * @param id El ID del estudiante.
   * @param updateStudentDto Objeto con los datos a actualizar.
   * @returns Mensaje de confirmación.
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStudentDto: UpdateStudentDto) {
    return this.studentService.update(+id, updateStudentDto);
  }
}
