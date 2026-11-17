#!/usr/bin/env python3
"""Consulta local somente de leitura. Nunca recebe token por argumento ou arquivo.

O ID da aplicação (não secreto) vem de MERCADOPAGO_APPLICATION_ID ou é digitado no
terminal; nenhum identificador real fica gravado no repositório.
"""
import getpass
import http.client
import json
import os
import re
import ssl
import sys
import warnings

APP_ID = re.compile(r"[1-9][0-9]{5,19}")


def allowed(path):
    return path == "/users/me" or re.fullmatch(r"/applications/[1-9][0-9]{5,19}", path) is not None


def read_json(path, token):
    if not allowed(path):
        raise ValueError("Consulta não permitida")
    connection = http.client.HTTPSConnection(
        "api.mercadolibre.com", timeout=15, context=ssl.create_default_context()
    )
    connection.set_debuglevel(0)
    try:
        # http.client não segue redirecionamentos nem faz novas tentativas.
        connection.request("GET", path, headers={
            "Authorization": "Bearer " + token, "Accept": "application/json"
        })
        response = connection.getresponse()
        if response.status != 200:
            return None
        body = response.read(65537)
        if len(body) > 65536:
            return None
        data = json.loads(body)
        return data if isinstance(data, dict) else None
    except Exception:
        return None
    finally:
        connection.close()


def identifier(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value > 0:
        return str(value)
    if isinstance(value, str) and value.isascii() and value.isdigit() and value[0:1] != "0":
        return value
    return None


def main():
    result = {"user_id": None, "pais": None, "conta_de_teste": None,
              "owner_id": None, "comparacao": "não verificada"}
    token = None
    try:
        if not sys.stdin.isatty() or not sys.stderr.isatty():
            raise RuntimeError("Terminal interativo obrigatório")
        app_id = os.environ.get("MERCADOPAGO_APPLICATION_ID") or input("ID da aplicação Mercado Pago: ")
        app_id = app_id.strip()
        if not APP_ID.fullmatch(app_id):
            raise ValueError("ID da aplicação inválido")
        with warnings.catch_warnings():
            # Recusa qualquer fallback que possa deixar os caracteres visíveis.
            warnings.simplefilter("error", getpass.GetPassWarning)
            token = getpass.getpass("Access Token de produção (entrada oculta): ")
        if not token or not token.isascii() or any(
            not (char.isalnum() or char in "-_") for char in token
        ):
            raise ValueError("Credencial inválida")
        account = read_json("/users/me", token)
        app = read_json("/applications/" + app_id, token)
        if account:
            result["user_id"] = identifier(account.get("id"))
            country = account.get("country_id")
            result["pais"] = country if isinstance(country, str) and len(country) == 2 and country.isascii() and country.isalpha() else None
            tags = account.get("tags")
            result["conta_de_teste"] = "test_user" in tags if isinstance(tags, list) else None
        if app:
            result["owner_id"] = identifier(app.get("owner_id"))
        if app and identifier(app.get("id")) == app_id and result["user_id"] and result["owner_id"]:
            result["comparacao"] = "mesmo titular" if result["user_id"] == result["owner_id"] else "titulares diferentes"
    except (Exception, KeyboardInterrupt):
        pass  # Nunca imprime exceções, respostas completas ou cabeçalhos.
    finally:
        token = None
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["comparacao"] == "mesmo titular" else 1


if __name__ == "__main__":
    raise SystemExit(main())
