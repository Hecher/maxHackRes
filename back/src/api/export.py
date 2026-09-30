from html import escape

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user_flexible
from src.database.session import get_db_session
from src.models.models import Attempt, Lab, User

router = APIRouter(prefix="/attempts", tags=["Экспорт"])

def _cell(value: object, cell_type: str = "String") -> str:
    if value is None or value == "":
        return "<Cell/>"
    return f'<Cell><Data ss:Type="{cell_type}">{escape(str(value))}</Data></Cell>'

@router.get("/{attempt_id}/export.xls", summary="Журнал замеров файлом Excel")
async def export_attempt(
    attempt_id: int,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_flexible),
):
    attempt = await session.get(Attempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    lab = await session.get(Lab, attempt.lab_id)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Работа не найдена")

    if current_user.role != "teacher" and attempt.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к этой попытке")

    student = await session.get(User, attempt.student_id)
    result = attempt.result_data or {}
    answers = result.get("answers", {}) if isinstance(result, dict) else {}
    rows = answers.get("rows", []) if isinstance(answers, dict) else []
    columns = answers.get("columns", []) if isinstance(answers, dict) else []

    header = "".join([_cell("№")] + [_cell(f"{c.get('label', '')}, {c.get('unit', '')}".strip(", ")) for c in columns])
    body_rows = []

    for row in rows:
        values = row.get("values", {}) if isinstance(row, dict) else {}
        cells = [_cell(row.get("number"), "Number")]
        for column in columns:
            value = values.get(column.get("key"))
            cells.append(_cell(value, "Number") if isinstance(value, (int, float)) else _cell(value))
        body_rows.append(f"<Row>{''.join(cells)}</Row>")

    info = [
        f"<Row>{_cell(lab.title)}</Row>",
        f"<Row>{_cell('Ученик: ' + (student.full_name if student else '—'))}</Row>",
        f"<Row>{_cell('Режим: ' + attempt.mode)}</Row>",
        f"<Row>{_cell('Оценка: ' + (str(attempt.grade) if attempt.grade is not None else '—'))}</Row>",
        f"<Row>{_cell('Вывод ученика: ' + str(answers.get('conclusion') or '—'))}</Row>",
        "<Row/>",
    ]

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<?mso-application progid="Excel.Sheet"?>\n'
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
        'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
        '<Worksheet ss:Name="Журнал замеров"><Table>'
        + "".join(info)
        + f"<Row>{header}</Row>"
        + "".join(body_rows)
        + "</Table></Worksheet></Workbook>"
    )

    filename = f"attempt-{attempt.id}.xls"
    return Response(
        content=xml.encode("utf-8"),
        media_type="application/vnd.ms-excel",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
