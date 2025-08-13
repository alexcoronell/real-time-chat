import { MigrationInterface, QueryRunner } from 'typeorm';

/* Department field added on user entity */
export class Migrations1755056213308 implements MigrationInterface {
  name = 'Migrations1755056213308';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_department_enum" AS ENUM('Desarrollo', 'Soporte Técnico', 'Ventas', 'Marketing')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "department" "public"."users_department_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "department"`);
    await queryRunner.query(`DROP TYPE "public"."users_department_enum"`);
  }
}
