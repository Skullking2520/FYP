from __future__ import annotations

import argparse
import secrets
import string
import sys

from app.config import build_sqlalchemy_db_url, settings
from app.database import Base, SessionLocal, engine
from app.models.user import User
from app.utils.password_hash import hash_password


def _ensure_tables() -> None:
    db_url = build_sqlalchemy_db_url(settings)
    if db_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)


def _generate_password(length: int = 20) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Create (or update) an admin user account. "
            "Admin access is granted by adding the email to ADMIN_EMAILS (JSON array)."
        )
    )
    parser.add_argument("--email", required=True, help="Admin user email")
    parser.add_argument("--password", default=None, help="Admin user password (generated if omitted)")
    parser.add_argument("--name", default="Admin", help="Display name")
    parser.add_argument(
        "--update-password",
        action="store_true",
        help="If the user exists, overwrite their password",
    )

    args = parser.parse_args(argv)

    _ensure_tables()

    password = args.password or _generate_password()

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == args.email).first()
        if user is None:
            user = User(email=args.email, password=hash_password(password), name=args.name)
            db.add(user)
            db.commit()
            db.refresh(user)
            created = True
        else:
            created = False
            if args.update_password:
                user.password = hash_password(password)
                if args.name:
                    user.name = args.name
                db.add(user)
                db.commit()

    admin_emails = getattr(settings, "admin_emails", []) or []
    if args.email not in admin_emails:
        sys.stderr.write(
            "WARNING: This user is not an admin yet. Set ADMIN_EMAILS as a JSON array, e.g.\n"
            f"  ADMIN_EMAILS=[\"{args.email}\"]\n"
        )

    if created:
        # Print the password so the operator can log in immediately.
        print(f"created user id={user.id} email={args.email}")
        if args.password is None:
            print(f"generated password: {password}")
    else:
        print(f"user already exists email={args.email}")
        if args.update_password:
            print("password updated")
        elif args.password is None:
            print("(password not changed)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
